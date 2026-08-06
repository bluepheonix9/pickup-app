import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { DIFFICULTY_OPTIONS, difficultyLabel } from '../lib/difficulty'
import { getAreas, getBrowseTags, getSports } from '../lib/games'
import { useRemoteGames } from '../lib/store'
import { colors } from '../theme'
import type { Difficulty, PriceFilter } from '../types/game'

export type HomeFilters = {
  sport: string // 'All' means unset
  area: string // 'All' means unset
  tag: string | null
  price: PriceFilter | 'all'
  difficulty: Difficulty | 'all'
}

export const DEFAULT_FILTERS: HomeFilters = {
  sport: 'All',
  area: 'All',
  tag: null,
  price: 'all',
  difficulty: 'all',
}

export function countActiveFilters(f: HomeFilters): number {
  let n = 0
  if (f.sport !== 'All') n++
  if (f.area !== 'All') n++
  if (f.tag) n++
  if (f.price !== 'all') n++
  if (f.difficulty !== 'all') n++
  return n
}

type FilterSheetProps = {
  visible: boolean
  initial: HomeFilters
  countFor: (draft: HomeFilters) => number
  onClose: () => void
  onApply: (filters: HomeFilters) => void
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
      <Text style={{ fontSize: 12, fontWeight: '500', color: selected ? colors.accentDark : colors.textSecondary }}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 10 }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  )
}

const DIFFICULTIES: (Difficulty | 'all')[] = ['all', ...DIFFICULTY_OPTIONS]
const PRICES: (PriceFilter | 'all')[] = ['all', 'free', 'paid']

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// One place to set every filter. Edits a draft, commits on Apply.
export function FilterSheet({ visible, initial, countFor, onClose, onApply }: FilterSheetProps) {
  const [draft, setDraft] = React.useState<HomeFilters>(initial)

  // Sync the draft to the live filters whenever the sheet opens.
  React.useEffect(() => {
    if (visible) setDraft(initial)
  }, [visible, initial])

  const remote = useRemoteGames()
  const sports = React.useMemo(() => ['All', ...getSports(remote)], [remote])
  const areas = React.useMemo(() => ['All', ...getAreas(remote)], [remote])
  const tags = React.useMemo(() => getBrowseTags(), [])
  const resultCount = countFor(draft)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 32,
            borderWidth: 0.5,
            borderColor: colors.borderStrong,
            maxHeight: '85%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 16 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.textPrimary }}>Filters</Text>
            <TouchableOpacity onPress={() => setDraft(DEFAULT_FILTERS)}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Section title="SPORT">
              {sports.map((s) => (
                <Chip key={s} label={s} selected={draft.sport === s} onPress={() => setDraft((d) => ({ ...d, sport: s }))} />
              ))}
            </Section>

            <Section title="AREA">
              {areas.map((a) => (
                <Chip key={a} label={a} selected={draft.area === a} onPress={() => setDraft((d) => ({ ...d, area: a }))} />
              ))}
            </Section>

            <Section title="TAG">
              <Chip label="Any" selected={draft.tag === null} onPress={() => setDraft((d) => ({ ...d, tag: null }))} />
              {tags.map((t) => (
                <Chip key={t} label={t} selected={draft.tag === t} onPress={() => setDraft((d) => ({ ...d, tag: d.tag === t ? null : t }))} />
              ))}
            </Section>

            <Section title="PRICE">
              {PRICES.map((p) => (
                <Chip key={p} label={p === 'all' ? 'Any' : cap(p)} selected={draft.price === p} onPress={() => setDraft((d) => ({ ...d, price: p }))} />
              ))}
            </Section>

            <Section title="DIFFICULTY">
              {DIFFICULTIES.map((lvl) => (
                <Chip key={lvl} label={lvl === 'all' ? 'Any' : difficultyLabel(lvl)} selected={draft.difficulty === lvl} onPress={() => setDraft((d) => ({ ...d, difficulty: lvl }))} />
              ))}
            </Section>
          </ScrollView>

          <TouchableOpacity
            onPress={() => onApply(draft)}
            disabled={resultCount === 0}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: resultCount === 0 ? colors.surface2 : colors.accent,
              borderRadius: 12,
              paddingVertical: 14,
              marginTop: 8,
              borderWidth: 0.5,
              borderColor: resultCount === 0 ? colors.borderStrong : colors.accent,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: resultCount === 0 ? colors.textMuted : colors.accentDark }}>
              {resultCount === 0 ? 'No games match' : `Show ${resultCount} game${resultCount === 1 ? '' : 's'}`}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
