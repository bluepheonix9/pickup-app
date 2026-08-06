import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import { formatDistance, getGameImageColor } from '../lib/games'
import { effectiveSpotsLeft, useIsJoined, useJoinedCount } from '../lib/store'
import { colors } from '../theme'
import type { Game } from '../types/game'
import { Difficulty } from './Difficulty'

// Compact card for horizontal carousels (curated Home rows). Deliberately
// smaller than the feed card so the rows read as "browse sideways", but it
// carries the same decision-critical info: photo, time, price, spots and level.
export function GameMiniCard({
  game,
  width = 190,
  // Distance from the user, shown only by the "near you" row.
  distanceKm,
}: {
  game: Game
  width?: number
  distanceKm?: number
}) {
  const joined = useIsJoined(game.id)
  const spotsLeft = effectiveSpotsLeft(game, useJoinedCount(game.id))
  const lowSpots = spotsLeft <= 3

  return (
    <TouchableOpacity
      onPress={() => router.push(`/game/${game.id}`)}
      style={{
        width,
        backgroundColor: colors.surface,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: joined ? colors.accent : colors.borderStrong,
      }}
    >
      <View style={{ height: 100, backgroundColor: getGameImageColor(game), justifyContent: 'flex-end', padding: 10 }}>
        {game.imageUrl && (
          <Image
            source={{ uri: game.imageUrl }}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        )}
        {/* Scrim so the title stays readable over a photo. */}
        {game.imageUrl && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        )}
        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <Difficulty level={game.difficulty} compact />
        </View>
        {joined && (
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="checkmark" size={10} color={colors.accentDark} />
            <Text style={{ color: colors.accentDark, fontSize: 9, fontWeight: '700' }}>You're in</Text>
          </View>
        )}
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '500', color: '#fff' }}>{game.title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 10, color: '#aaa' }}>{game.venue.name}</Text>
      </View>
      <View style={{ padding: 8, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>{game.sport}</Text>
          {distanceKm !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="navigate-outline" size={9} color={colors.textSecondary} />
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>{formatDistance(distanceKm)}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>{game.startTime}</Text>
          <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '500' }}>{game.price}</Text>
        </View>
        <Text
          style={{
            fontSize: 10,
            color: joined ? colors.accent : lowSpots ? colors.warning : colors.textMuted,
            fontWeight: lowSpots && !joined ? '600' : '400',
          }}
        >
          {joined ? "You're in" : `${spotsLeft} spots left`}
        </Text>
      </View>
    </TouchableOpacity>
  )
}
