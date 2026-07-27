import * as Haptics from 'expo-haptics'
import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../src/theme'
import { GameHero } from '../../src/components/GameHero'
import { Difficulty } from '../../src/components/Difficulty'
import { GameChat } from '../../src/components/GameChat'
import { JoinSheet } from '../../src/components/JoinSheet'
import { formatGameDateLong, formatVenueLabel } from '../../src/lib/games'
import { deleteGame } from '../../src/lib/gamesSync'
import { effectiveSpotsLeft, joinGame, leaveGame, removeLocalGame, toggleSaved, useIsHosted, useIsJoined, useIsSaved, useJoinedCount, useRemoteGames } from '../../src/lib/store'
import type { GameStatus } from '../../src/types/game'

function BadgePill({ status }: { status: GameStatus }) {
  if (status === 'live') {
    return (
      <View style={{ backgroundColor: colors.live, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>● In progress</Text>
      </View>
    )
  }
  if (status === 'upcoming') {
    return (
      <View style={{ backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ color: colors.accentDark, fontSize: 11, fontWeight: '600' }}>Upcoming</Text>
      </View>
    )
  }
  return (
    <View style={{ backgroundColor: 'transparent', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.accent }}>
      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>Open to join</Text>
    </View>
  )
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 0.5,
          borderColor: colors.borderStrong,
        }}
      >
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }}>{value}</Text>
      </View>
    </View>
  )
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const saved = useIsSaved(id ?? '')
  const joined = useIsJoined(id ?? '')
  const joinedCount = useJoinedCount(id ?? '')
  // Subscribes to hostedGames, so the screen re-derives after an edit/cancel.
  const hosted = useIsHosted(id ?? '')
  // Subscribe to the games list so the screen re-renders once games load — e.g.
  // on a direct load / deep link that lands here before the fetch completes.
  const remote = useRemoteGames()
  const game = id ? remote.find((g) => g.id === id) : undefined
  const [sheetVisible, setSheetVisible] = React.useState(false)
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [cancelling, setCancelling] = React.useState(false)

  if (!game) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 17, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Game not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: colors.accent }}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const spotsLeft = effectiveSpotsLeft(game, joinedCount)

  async function handleCancel() {
    if (!confirmCancel) {
      setConfirmCancel(true)
      Haptics.selectionAsync()
      return
    }
    setCancelling(true)
    const { error } = await deleteGame(game!.id)
    if (error) {
      setCancelling(false)
      setConfirmCancel(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not cancel game', error)
      return
    }
    removeLocalGame(game!.id)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ position: 'relative' }}>
          <GameHero game={game} height={300} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }} />
          <View style={{ position: 'absolute', top: 56, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
                padding: 8,
                borderWidth: 0.5,
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                toggleSaved(game.id)
                Haptics.selectionAsync()
              }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 20,
                padding: 8,
                borderWidth: 0.5,
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? colors.accent : '#fff'} />
            </TouchableOpacity>
          </View>
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <BadgePill status={game.status} />
              {hosted && (
                <View style={{ backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: colors.accentDark, fontSize: 11, fontWeight: '600' }}>Hosted by you</Text>
                </View>
              )}
              {game.featured && (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' }}>
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>Featured</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 28, fontWeight: '500', color: '#fff', marginBottom: 4 }}>{game.title}</Text>
            <Text style={{ fontSize: 14, color: '#ccc' }}>{formatVenueLabel(game)}</Text>
          </View>
        </View>

        <View style={{ padding: 16, gap: 20 }}>
          <Difficulty level={game.difficulty} />

          <View style={{ gap: 14 }}>
            <DetailRow icon="calendar-outline" label="Date" value={formatGameDateLong(game)} />
            <DetailRow icon="time-outline" label="Start time" value={game.startTime} />
            <DetailRow icon="pricetag-outline" label="Entry" value={game.price} />
            <DetailRow icon="football-outline" label="Sport" value={game.sport} />
            <DetailRow icon="people-outline" label="Spots" value={`${spotsLeft} of ${game.spots} spots left`} />
            <DetailRow icon="location-outline" label="Venue" value={formatVenueLabel(game)} />
            {game.organizer && (
              <DetailRow icon="person-outline" label="Organizer" value={hosted ? 'You' : game.organizer.name} />
            )}
          </View>

          {game.tags.length > 0 && (
            <View>
              <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 10 }}>TAGS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {game.tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderWidth: 0.5,
                      borderColor: colors.borderStrong,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 0.5,
              borderColor: joined ? colors.accent : colors.borderStrong,
            }}
          >
            <Text style={{ fontSize: 18 }}>{joined ? '✅' : '👥'}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {joined ? (
                <><Text style={{ color: colors.textPrimary, fontWeight: '500' }}>You're in.</Text> {spotsLeft} spots left</>
              ) : (
                <><Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{spotsLeft}</Text> spots left</>
              )}
            </Text>
          </View>

          {hosted ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => router.push(`/host-game?id=${game.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.accent,
                  borderRadius: 12,
                  paddingVertical: 14,
                }}
              >
                <Ionicons name="create-outline" size={18} color={colors.accentDark} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accentDark }}>Edit game</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancel}
                disabled={cancelling}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: colors.live,
                }}
              >
                {cancelling ? (
                  <ActivityIndicator color={colors.live} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color={colors.live} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.live }}>
                      {confirmCancel ? 'Tap again to cancel game' : 'Cancel game'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : joined ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: colors.accent,
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accent }}>You're in</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  leaveGame(game.id)
                  Haptics.selectionAsync()
                }}
                style={{ alignItems: 'center', paddingVertical: 8 }}
              >
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Leave game</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setSheetVisible(true)
                Haptics.selectionAsync()
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.accent,
                borderRadius: 12,
                paddingVertical: 14,
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.accentDark} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accentDark }}>Join this game</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/map')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingVertical: 14,
              borderWidth: 0.5,
              borderColor: colors.borderStrong,
            }}
          >
            <Ionicons name="map-outline" size={18} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>View on map</Text>
          </TouchableOpacity>

          {(joined || hosted) && <GameChat gameId={game.id} />}
        </View>
      </ScrollView>

      <JoinSheet
        game={game}
        visible={sheetVisible}
        spotsLeft={spotsLeft}
        onClose={() => setSheetVisible(false)}
        onConfirm={() => {
          joinGame(game.id)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }}
      />
    </View>
  )
}
