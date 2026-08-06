import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import React from 'react'
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { DateTimeField } from '../src/components/DateTimeField'
import { useAuth } from '../src/lib/auth'
import { formatStartTime, formatTimeLabel, isSameDay, nextHalfHour, normalizeEnd } from '../src/lib/dates'
import { DIFFICULTY_OPTIONS, difficultyLabel } from '../src/lib/difficulty'
import { AREA_OPTIONS, getBrowseTags, getGameById, SPORT_OPTIONS } from '../src/lib/games'
import { insertGame, updateGame, type GameInput } from '../src/lib/gamesSync'
import { pickGameImage, uploadGameImage, type PickedImage } from '../src/lib/imageUpload'
import { upsertLocalGame, useRemoteGames } from '../src/lib/store'
import { requestVenuePick } from '../src/lib/venuePicker'
import { colors } from '../src/theme'
import type { Difficulty } from '../src/types/game'

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.accent : colors.surface2,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 0.5,
        borderColor: selected ? colors.accent : colors.borderStrong,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '500', color: selected ? colors.accentDark : colors.textSecondary }}>{label}</Text>
    </TouchableOpacity>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  )
}

function Field(props: {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
  keyboardType?: 'number-pad'
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface2,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 0.5,
        borderColor: colors.borderStrong,
      }}
    >
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={props.keyboardType}
        style={{ flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 12 }}
      />
    </View>
  )
}

export default function HostGameScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>()
  const remote = useRemoteGames()
  const editing = React.useMemo(() => (editId ? getGameById(editId) : undefined), [editId, remote])
  const { user } = useAuth()
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  const [sport, setSport] = React.useState(() => editing?.sport ?? '')
  const [title, setTitle] = React.useState(() => editing?.title ?? '')
  const [titleEdited, setTitleEdited] = React.useState(!!editing)
  const [venueName, setVenueName] = React.useState(() =>
    editing && editing.venue.name !== 'TBC' ? editing.venue.name : '',
  )
  const [venueCoords, setVenueCoords] = React.useState<{ lat: number; lng: number } | null>(() =>
    editing && (editing.venue.lat !== 0 || editing.venue.lng !== 0)
      ? { lat: editing.venue.lat, lng: editing.venue.lng }
      : null,
  )
  // Web has no map picker (pick-venue is native-only), so coordinates are typed
  // in directly there. These back the two web fields and sync into venueCoords.
  const [latInput, setLatInput] = React.useState(() =>
    editing && editing.venue.lat !== 0 ? String(editing.venue.lat) : '',
  )
  const [lngInput, setLngInput] = React.useState(() =>
    editing && editing.venue.lng !== 0 ? String(editing.venue.lng) : '',
  )
  React.useEffect(() => {
    if (Platform.OS !== 'web') return
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    setVenueCoords(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null)
  }, [latInput, lngInput])
  const [area, setArea] = React.useState(() => editing?.venue.area ?? '')
  const [startsAt, setStartsAt] = React.useState<Date | null>(() =>
    editing ? new Date(editing.startsAt) : null,
  )
  const [endsAt, setEndsAt] = React.useState<Date | null>(() =>
    editing?.endsAt ? new Date(editing.endsAt) : null,
  )
  const [showEnd, setShowEnd] = React.useState(() => !!editing?.endsAt)
  const [spots, setSpots] = React.useState(() => (editing ? String(editing.spots) : ''))
  const [priceMode, setPriceMode] = React.useState<'free' | 'paid' | null>(() =>
    editing ? (editing.price === 'Free' ? 'free' : 'paid') : null,
  )
  const [priceAmount, setPriceAmount] = React.useState(() =>
    editing && editing.price !== 'Free' ? editing.price : '',
  )
  const [difficulty, setDifficulty] = React.useState<Difficulty | null>(() => editing?.difficulty ?? null)
  const [tags, setTags] = React.useState<string[]>(() => editing?.tags ?? [])
  // The already-uploaded photo (when editing), and a freshly picked one that
  // hasn't been uploaded yet. The new pick wins for both preview and save.
  const [savedImageUrl, setSavedImageUrl] = React.useState<string | undefined>(() => editing?.imageUrl)
  const [pickedImage, setPickedImage] = React.useState<PickedImage | null>(null)
  const previewUri = pickedImage?.uri ?? savedImageUrl

  // A game can't start in the past. Existing games keep their original start as
  // the floor so editing one that already began doesn't force a reschedule.
  const minimumDate = React.useMemo(
    () => (editing ? new Date(Math.min(new Date(editing.startsAt).getTime(), Date.now())) : new Date()),
    [editing],
  )

  // The end time is entered as a clock time, so it lands on the start's day —
  // roll it forward when the game runs past midnight.
  const resolvedEnd = React.useMemo(
    () => (startsAt && showEnd && endsAt ? normalizeEnd(startsAt, endsAt) : null),
    [startsAt, showEnd, endsAt],
  )
  const endsNextDay = resolvedEnd !== null && startsAt !== null && !isSameDay(startsAt, resolvedEnd)

  // The venue search fills these in, but a hand-dropped pin may not resolve to
  // a known suburb — keep any area it did find selectable alongside the presets.
  const areaOptions = React.useMemo(
    () => (area !== '' && !AREA_OPTIONS.includes(area) ? [area, ...AREA_OPTIONS] : AREA_OPTIONS),
    [area],
  )

  const canPost =
    sport !== '' &&
    area !== '' &&
    venueCoords !== null &&
    startsAt !== null &&
    spots.trim() !== '' &&
    priceMode !== null &&
    difficulty !== null &&
    !saving

  function autoTitle(nextSport: string, nextArea: string) {
    if (!titleEdited && nextSport && nextArea) setTitle(`${nextSport} — ${nextArea}`)
  }

  function toggleTag(tag: string) {
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]))
  }

  async function choosePhoto() {
    const { image, error: pickError } = await pickGameImage()
    if (pickError) {
      setError(pickError)
      return
    }
    if (!image) return // User backed out of the picker.
    setError('')
    setPickedImage(image)
  }

  function removePhoto() {
    setPickedImage(null)
    setSavedImageUrl(undefined)
  }

  function pickLocation() {
    requestVenuePick((pick) => {
      setVenueCoords({ lat: pick.lat, lng: pick.lng })
      // Only overwrite what the host hasn't already typed themselves.
      if (pick.name && venueName.trim() === '') setVenueName(pick.name)
      if (pick.area) {
        setArea(pick.area)
        autoTitle(sport, pick.area)
      }
    })
    router.push('/pick-venue')
  }

  async function post() {
    if (!canPost || !startsAt || !difficulty) return
    if (!user) {
      setError('You must be signed in to host a game.')
      return
    }
    const totalSpots = parseInt(spots, 10) || 10
    // Preserve how many spots are already taken as total spots changes on edit.
    const taken = editing ? editing.spots - editing.spotsLeft : 0

    setSaving(true)
    setError('')

    // Upload a newly picked photo first — no point writing the game row if the
    // image fails. An unchanged photo keeps whatever URL it already had.
    let imageUrl = savedImageUrl
    if (pickedImage) {
      const { url, error: uploadError } = await uploadGameImage(user.id, pickedImage)
      if (uploadError || !url) {
        setSaving(false)
        setError(uploadError ?? 'Could not upload that photo.')
        return
      }
      imageUrl = url
    }

    const input: GameInput = {
      title: title.trim() || `${sport} — ${area}`,
      sport,
      difficulty,
      tags,
      venue: { name: venueName.trim() || 'TBC', area, lat: venueCoords?.lat ?? 0, lng: venueCoords?.lng ?? 0 },
      startsAt: startsAt.toISOString(),
      endsAt: resolvedEnd?.toISOString(),
      startTime: formatStartTime(startsAt, resolvedEnd),
      price: priceMode === 'free' ? 'Free' : priceAmount.trim() || '$?',
      status: editing?.status ?? 'open',
      imageUrl,
      imageFallback: editing?.imageFallback ?? '#1A1A1A',
      featured: editing?.featured ?? false,
      spots: totalSpots,
      spotsLeft: editing ? Math.max(0, totalSpots - taken) : totalSpots,
    }

    const { game, error: err } = editing
      ? await updateGame(editing.id, input)
      : await insertGame(user.id, input)

    if (err || !game) {
      setSaving(false)
      setError(err ?? 'Something went wrong.')
      return
    }

    upsertLocalGame(game)
    router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{editing ? 'Edit game' : 'Host a game'}</Text>
        <TouchableOpacity onPress={post} disabled={!canPost} hitSlop={8}>
          {saving ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '600', color: canPost ? colors.accent : colors.textMuted }}>{editing ? 'Save' : 'Post'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error !== '' && (
            <View
              style={{
                backgroundColor: 'rgba(255,59,48,0.15)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                borderWidth: 0.5,
                borderColor: colors.live,
              }}
            >
              <Text style={{ fontSize: 13, color: colors.live }}>{error}</Text>
            </View>
          )}

          <Section title="SPORT">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SPORT_OPTIONS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={sport === s}
                  onPress={() => {
                    setSport(s)
                    autoTitle(s, area)
                  }}
                />
              ))}
            </ScrollView>
          </Section>

          <Section title="TITLE">
            <Field
              value={title}
              onChangeText={(text) => {
                setTitle(text)
                setTitleEdited(true)
              }}
              placeholder="e.g. 3v3 Basketball — Bondi"
            />
          </Section>

          <Section title="PHOTO (OPTIONAL)">
            {previewUri ? (
              <View style={{ gap: 8 }}>
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: colors.surface2 }}
                  resizeMode="cover"
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={choosePhoto}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: colors.surface2,
                      borderRadius: 12,
                      paddingVertical: 10,
                      borderWidth: 0.5,
                      borderColor: colors.borderStrong,
                    }}
                  >
                    <Ionicons name="swap-horizontal-outline" size={15} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Replace</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={removePhoto}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: colors.surface2,
                      borderRadius: 12,
                      paddingVertical: 10,
                      borderWidth: 0.5,
                      borderColor: colors.borderStrong,
                    }}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={choosePhoto}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.surface2,
                  borderRadius: 12,
                  paddingVertical: 28,
                  borderWidth: 0.5,
                  borderStyle: 'dashed',
                  borderColor: colors.borderStrong,
                }}
              >
                <Ionicons name="image-outline" size={22} color={colors.textSecondary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Add a photo</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Shown on your game card</Text>
              </TouchableOpacity>
            )}
          </Section>

          <Section title="LOCATION">
            {Platform.OS === 'web' ? (
              // No map picker on web — enter coordinates directly.
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field value={latInput} onChangeText={setLatInput} placeholder="Latitude e.g. -33.89" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field value={lngInput} onChangeText={setLngInput} placeholder="Longitude e.g. 151.27" />
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickLocation}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: colors.surface2,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderWidth: 0.5,
                  borderColor: venueCoords ? colors.accent : colors.borderStrong,
                }}
              >
                <Ionicons name="search-outline" size={16} color={venueCoords ? colors.accent : colors.textSecondary} />
                <Text style={{ flex: 1, fontSize: 13, color: venueCoords ? colors.textPrimary : colors.textSecondary }} numberOfLines={1}>
                  {venueCoords
                    ? venueName.trim() || `${venueCoords.lat.toFixed(4)}, ${venueCoords.lng.toFixed(4)}`
                    : 'Search for a venue or drop a pin'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            {venueCoords === null && (
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                A location is required so your game appears on the map.
              </Text>
            )}
          </Section>

          <Section title="VENUE NAME">
            <Field value={venueName} onChangeText={setVenueName} placeholder="e.g. Bondi Skate Park Courts" />
          </Section>

          <Section title="AREA">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {areaOptions.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  selected={area === a}
                  onPress={() => {
                    setArea(a)
                    autoTitle(sport, a)
                  }}
                />
              ))}
            </View>
          </Section>

          <Section title="STARTS">
            <DateTimeField
              mode="datetime"
              value={startsAt}
              onChange={setStartsAt}
              placeholder="Pick a date and time"
              minimumDate={minimumDate}
            />
          </Section>

          <Section title="ENDS (OPTIONAL)">
            {showEnd ? (
              <View style={{ gap: 8 }}>
                <DateTimeField
                  mode="time"
                  value={endsAt}
                  onChange={setEndsAt}
                  placeholder="Pick an end time"
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {startsAt && resolvedEnd
                      ? `${formatTimeLabel(startsAt)} – ${formatTimeLabel(resolvedEnd)}${endsNextDay ? ' (next day)' : ''}`
                      : 'Set a start time first.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowEnd(false)
                      setEndsAt(null)
                    }}
                    hitSlop={8}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setShowEnd(true)
                  // Default to an hour and a half of play.
                  const base = startsAt ?? nextHalfHour()
                  setEndsAt(new Date(base.getTime() + 90 * 60_000))
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: colors.surface2,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderWidth: 0.5,
                  borderColor: colors.borderStrong,
                }}
              >
                <Ionicons name="add" size={16} color={colors.textSecondary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Add an end time</Text>
              </TouchableOpacity>
            )}
          </Section>

          <Section title="SPOTS">
            <Field value={spots} onChangeText={setSpots} placeholder="e.g. 10" keyboardType="number-pad" />
          </Section>

          <Section title="PRICE">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: priceMode === 'paid' ? 10 : 0 }}>
              <Chip label="Free" selected={priceMode === 'free'} onPress={() => setPriceMode('free')} />
              <Chip label="Paid →" selected={priceMode === 'paid'} onPress={() => setPriceMode('paid')} />
            </View>
            {priceMode === 'paid' && <Field value={priceAmount} onChangeText={setPriceAmount} placeholder="$5" />}
          </Section>

          <Section title="DIFFICULTY">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DIFFICULTY_OPTIONS.map((level) => (
                <Chip
                  key={level}
                  label={difficultyLabel(level)}
                  selected={difficulty === level}
                  onPress={() => setDifficulty(level)}
                />
              ))}
            </View>
          </Section>

          <Section title="TAGS (OPTIONAL)">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {getBrowseTags().map((tag) => (
                <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => toggleTag(tag)} />
              ))}
            </View>
          </Section>

          <TouchableOpacity
            onPress={post}
            disabled={!canPost}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: canPost ? colors.accent : colors.surface2,
              borderRadius: 12,
              paddingVertical: 14,
              borderWidth: 0.5,
              borderColor: canPost ? colors.accent : colors.borderStrong,
            }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : (
              <>
                <Ionicons name={editing ? 'checkmark-outline' : 'megaphone-outline'} size={18} color={canPost ? colors.accentDark : colors.textMuted} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: canPost ? colors.accentDark : colors.textMuted }}>
                  {canPost ? (editing ? 'Save changes' : 'Post game') : 'Fill in the required fields'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
