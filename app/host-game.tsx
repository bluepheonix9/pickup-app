import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import React from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { daysUntilWeekday, relativeISO } from '../src/lib/dates'
import { useAuth } from '../src/lib/auth'
import { AREA_OPTIONS, getBrowseTags, getGameById, SPORT_OPTIONS } from '../src/lib/games'
import { insertGame, updateGame, type GameInput } from '../src/lib/gamesSync'
import { upsertLocalGame, useRemoteGames } from '../src/lib/store'
import { requestVenuePick } from '../src/lib/venuePicker'
import { colors } from '../src/theme'
import type { Difficulty } from '../src/types/game'

const SATURDAY = 6

type DateChoice = 'today' | 'tomorrow' | 'weekend'

const DATE_CHIPS: { key: DateChoice; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
]

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function daysFromToday(choice: DateChoice): number {
  if (choice === 'today') return 0
  if (choice === 'tomorrow') return 1
  return daysUntilWeekday(SATURDAY)
}

// ---- Reverse-mapping helpers, used to prefill the form when editing ----

function calendarDay(d: Date): number {
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000)
}

// Best-effort: the exact date isn't stored, only which chip produced it.
function deriveDateChoice(iso: string): DateChoice {
  const diff = calendarDay(new Date(iso)) - calendarDay(new Date())
  if (diff <= 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return 'weekend'
}

function formatTimeInput(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Loose "6pm" / "6:30 PM" / "18:00" parse; null when it doesn't look like a time.
function parseTime(raw: string): { hour: number; minute: number } | null {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const meridiem = m[3]?.toLowerCase()
  if (hour > 23 || minute > 59) return null
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  return { hour, minute }
}

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
  const [dateChoice, setDateChoice] = React.useState<DateChoice | null>(() =>
    editing ? deriveDateChoice(editing.startsAt) : null,
  )
  const [time, setTime] = React.useState(() => (editing ? formatTimeInput(editing.startsAt) : ''))
  const [spots, setSpots] = React.useState(() => (editing ? String(editing.spots) : ''))
  const [priceMode, setPriceMode] = React.useState<'free' | 'paid' | null>(() =>
    editing ? (editing.price === 'Free' ? 'free' : 'paid') : null,
  )
  const [priceAmount, setPriceAmount] = React.useState(() =>
    editing && editing.price !== 'Free' ? editing.price : '',
  )
  const [difficulty, setDifficulty] = React.useState<Difficulty | null>(() => editing?.difficulty ?? null)
  const [tags, setTags] = React.useState<string[]>(() => editing?.tags ?? [])

  const canPost =
    sport !== '' &&
    area !== '' &&
    venueCoords !== null &&
    dateChoice !== null &&
    time.trim() !== '' &&
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

  function pickLocation() {
    requestVenuePick(({ lat, lng }) => setVenueCoords({ lat, lng }))
    router.push('/pick-venue')
  }

  async function post() {
    if (!canPost || !dateChoice || !difficulty) return
    if (!user) {
      setError('You must be signed in to host a game.')
      return
    }
    const parsed = parseTime(time)
    const trimmedTime = time.trim()
    const totalSpots = parseInt(spots, 10) || 10
    // Preserve how many spots are already taken as total spots changes on edit.
    const taken = editing ? editing.spots - editing.spotsLeft : 0

    const input: GameInput = {
      title: title.trim() || `${sport} — ${area}`,
      sport,
      difficulty,
      tags,
      venue: { name: venueName.trim() || 'TBC', area, lat: venueCoords?.lat ?? 0, lng: venueCoords?.lng ?? 0 },
      startsAt: relativeISO(daysFromToday(dateChoice), parsed?.hour ?? 18, parsed?.minute ?? 0),
      startTime: trimmedTime ? `Starts ${trimmedTime}` : 'Starts 6pm',
      price: priceMode === 'free' ? 'Free' : priceAmount.trim() || '$?',
      status: editing?.status ?? 'open',
      imageFallback: editing?.imageFallback ?? '#1A1A1A',
      featured: editing?.featured ?? false,
      spots: totalSpots,
      spotsLeft: editing ? Math.max(0, totalSpots - taken) : totalSpots,
    }

    setSaving(true)
    setError('')
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

          <Section title="VENUE NAME">
            <Field value={venueName} onChangeText={setVenueName} placeholder="e.g. Bondi Skate Park Courts" />
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
                <Ionicons name="location-outline" size={16} color={venueCoords ? colors.accent : colors.textSecondary} />
                <Text style={{ fontSize: 13, color: venueCoords ? colors.textPrimary : colors.textSecondary }}>
                  {venueCoords
                    ? `📍 Selected: ${venueCoords.lat.toFixed(4)}, ${venueCoords.lng.toFixed(4)}`
                    : 'Pick location on map'}
                </Text>
              </TouchableOpacity>
            )}
            {venueCoords === null && (
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                A location is required so your game appears on the map.
              </Text>
            )}
          </Section>

          <Section title="AREA">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {AREA_OPTIONS.map((a) => (
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

          <Section title="DATE">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DATE_CHIPS.map((chip) => (
                <Chip key={chip.key} label={chip.label} selected={dateChoice === chip.key} onPress={() => setDateChoice(chip.key)} />
              ))}
            </View>
          </Section>

          <Section title="TIME">
            <Field value={time} onChangeText={setTime} placeholder="e.g. 6:00 PM" />
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
              {DIFFICULTIES.map((level) => (
                <Chip key={level} label={cap(level)} selected={difficulty === level} onPress={() => setDifficulty(level)} />
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
