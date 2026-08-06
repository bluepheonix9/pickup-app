import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { DIFFICULTY_CONFIG } from '../lib/difficulty'
import type { Difficulty as DifficultyLevel } from '../types/game'

type DifficultyProps = {
  level: DifficultyLevel
  compact?: boolean
}

export function Difficulty({ level, compact = false }: DifficultyProps) {
  const { label, shortLabel, icon, color, bg, border } = DIFFICULTY_CONFIG[level]

  if (compact) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          backgroundColor: bg,
          borderRadius: 20,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderWidth: 0.5,
          borderColor: border,
        }}
      >
        <Ionicons name={icon} size={10} color={color} />
        <Text style={{ fontSize: 10, fontWeight: '600', color }}>{shortLabel}</Text>
      </View>
    )
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: bg,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 0.5,
        borderColor: border,
      }}
    >
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ fontSize: 11, fontWeight: '600', color }}>{label}</Text>
    </View>
  )
}
