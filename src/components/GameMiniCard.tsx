import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'
import { getGameImageColor } from '../lib/games'
import { effectiveSpotsLeft, useIsJoined, useJoinedCount } from '../lib/store'
import { colors } from '../theme'
import type { Game } from '../types/game'
import { Difficulty } from './Difficulty'

// Compact card for horizontal carousels (curated Home rows).
export function GameMiniCard({ game, width = 190 }: { game: Game; width?: number }) {
  const joined = useIsJoined(game.id)
  const spotsLeft = effectiveSpotsLeft(game, useJoinedCount(game.id))

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
        <Text style={{ fontSize: 10, color: colors.textMuted }}>{game.sport}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>{game.startTime}</Text>
          <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '500' }}>{game.price}</Text>
        </View>
        <Text style={{ fontSize: 10, color: colors.textMuted }}>{spotsLeft} spots left</Text>
      </View>
    </TouchableOpacity>
  )
}
