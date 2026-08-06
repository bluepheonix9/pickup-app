import type { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import type { Difficulty } from '../types/game'

// Single source of truth for how each difficulty level is presented: the long
// form used on forms and the detail screen, and a short form for the compact
// badges on cards where horizontal space is tight.

export type DifficultyConfig = {
  label: string
  shortLabel: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  bg: string
  border: string
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  open: {
    label: 'Open to all',
    shortLabel: 'All levels',
    icon: 'people-outline',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.12)',
    border: '#38bdf8',
  },
  beginner: {
    label: 'Beginner friendly',
    shortLabel: 'Beginner',
    icon: 'leaf-outline',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.12)',
    border: '#4ade80',
  },
  intermediate: {
    label: 'Intermediate',
    shortLabel: 'Intermediate',
    icon: 'flash-outline',
    color: colors.accent,
    bg: 'rgba(200,241,53,0.12)',
    border: colors.accent,
  },
  advanced: {
    label: 'Advanced',
    shortLabel: 'Advanced',
    icon: 'flame-outline',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    border: '#f97316',
  },
}

// Order used by every picker and filter list — easiest level first, with the
// catch-all in front so hosts see it as the default-ish choice.
export const DIFFICULTY_OPTIONS: Difficulty[] = ['open', 'beginner', 'intermediate', 'advanced']

export function difficultyLabel(level: Difficulty): string {
  return DIFFICULTY_CONFIG[level].label
}
