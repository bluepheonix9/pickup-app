import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import React from 'react'
import { Image, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native'
import { Difficulty } from '../../src/components/Difficulty'
import { DEFAULT_FILTERS, FilterSheet, countActiveFilters, type HomeFilters } from '../../src/components/FilterSheet'
import { GameMiniCard } from '../../src/components/GameMiniCard'
import { formatVenueLabel, getFeaturedWeekendGames, getFeedGames, getFreeGames, getGameImageColor, getNearbyGames } from '../../src/lib/games'
import { loadGames } from '../../src/lib/gamesSync'
import { effectiveSpotsLeft, toggleSaved, useIsJoined, useIsSaved, useJoinedCount, useRemoteGames } from '../../src/lib/store'
import { colors } from '../../src/theme'
import type { Game, GameFilters, GameStatus, TimeWindow } from '../../src/types/game'

const TABS: { label: string; when: TimeWindow; section: string }[] = [
  { label: 'Today', when: 'today', section: 'HAPPENING TODAY' },
  { label: 'Upcoming', when: 'upcoming', section: 'COMING UP' },
  { label: 'Past events', when: 'past', section: 'PAST GAMES' },
]

const WARNING = '#FF9500'

// Fold the Home filter state + active time tab into a lib query.
function toGameFilters(when: TimeWindow, f: HomeFilters): GameFilters {
  return {
    when,
    sport: f.sport === 'All' ? undefined : f.sport,
    area: f.area === 'All' ? undefined : f.area,
    tag: f.tag ?? undefined,
    price: f.price === 'all' ? undefined : f.price,
    difficulty: f.difficulty === 'all' ? undefined : f.difficulty,
  }
}

function BadgePill({ status }: { status: GameStatus }) {
  if (status === 'live') return (
    <View style={{ backgroundColor: colors.live, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>● In progress</Text>
    </View>
  )
  if (status === 'upcoming') return (
    <View style={{ backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: colors.accentDark, fontSize: 10, fontWeight: '600' }}>Upcoming</Text>
    </View>
  )
  return (
    <View style={{ backgroundColor: 'transparent', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: colors.accent }}>
      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '600' }}>Open to join</Text>
    </View>
  )
}

function GameCard({ game }: { game: Game }) {
  const saved = useIsSaved(game.id)
  const joined = useIsJoined(game.id)
  const spotsLeft = effectiveSpotsLeft(game, useJoinedCount(game.id))
  const lowSpots = spotsLeft <= 3

  return (
    <TouchableOpacity onPress={() => router.push(`/game/${game.id}`)} style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: joined ? colors.accent : colors.borderStrong }}>
      <View style={{ height: 160, backgroundColor: getGameImageColor(game), alignItems: 'center', justifyContent: 'center' }}>
        {game.imageUrl && <Image source={{ uri: game.imageUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
        <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 }}>
          <BadgePill status={game.status} />
          {joined && (
            <View style={{ backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="checkmark" size={11} color={colors.accentDark} />
              <Text style={{ color: colors.accentDark, fontSize: 10, fontWeight: '700' }}>You're in</Text>
            </View>
          )}
        </View>
        <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: '#444' }}>
          <Text style={{ color: '#ccc', fontSize: 10 }}>{game.sport}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            toggleSaved(game.id)
            Haptics.selectionAsync()
          }}
          hitSlop={8}
          style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6, borderWidth: 0.5, borderColor: '#444' }}
        >
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={16} color={saved ? colors.accent : '#fff'} />
        </TouchableOpacity>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 48, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Text style={{ fontSize: 15, fontWeight: '500', color: '#fff' }}>{game.title}</Text>
          <Text style={{ fontSize: 11, color: '#aaa' }}>{formatVenueLabel(game)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderTopWidth: 0.5, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>{game.startTime}</Text>
          <Text style={{ color: '#444' }}>·</Text>
          <Text style={{ fontSize: 11, color: colors.accent }}>{game.price}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {joined ? (
            <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '600' }}>You're in</Text>
          ) : (
            <Text style={{ fontSize: 11, color: lowSpots ? WARNING : colors.textMuted, fontWeight: lowSpots ? '600' : '400' }}>{spotsLeft} spots left</Text>
          )}
          <Difficulty level={game.difficulty} compact />
        </View>
      </View>
    </TouchableOpacity>
  )
}

function CuratedRow({ title, games }: { title: string; games: Game[] }) {
  if (games.length === 0) return null
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 10, paddingHorizontal: 16 }}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
        {games.map((game) => <GameMiniCard key={game.id} game={game} />)}
      </ScrollView>
    </View>
  )
}

function CuratedSections({ games }: { games: Game[] }) {
  return (
    <View style={{ paddingTop: 4 }}>
      <CuratedRow title="NEAR YOU" games={getNearbyGames(games)} />
      <CuratedRow title="FEATURED THIS WEEKEND" games={getFeaturedWeekendGames(games)} />
      <CuratedRow title="FREE GAMES" games={getFreeGames(games)} />
    </View>
  )
}

function EmptyFeed({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 32 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>No games {label.toLowerCase()}</Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>Try a different time or loosen your filters — new pickup games are added all the time.</Text>
    </View>
  )
}

export default function HomeScreen() {
  const [activeTab, setActiveTab] = React.useState<TimeWindow>('today')
  const [filters, setFilters] = React.useState<HomeFilters>(DEFAULT_FILTERS)
  const [sheetVisible, setSheetVisible] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)

  const tab = TABS.find((t) => t.when === activeTab) ?? TABS[0]
  const activeCount = countActiveFilters(filters)

  const remote = useRemoteGames()
  const games = React.useMemo(
    () => getFeedGames(remote, toGameFilters(activeTab, filters)),
    [remote, activeTab, filters],
  )

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true)
    loadGames().finally(() => setRefreshing(false))
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '500', color: colors.textPrimary }}>
          pickup<Text style={{ color: colors.accent }}>.</Text>
        </Text>
        <TouchableOpacity onPress={() => router.push('/search')} hitSlop={8}>
          <Ionicons name="search-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Time tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border, marginBottom: 10 }}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.when}
            onPress={() => setActiveTab(t.when)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: activeTab === t.when ? colors.accent : 'transparent', marginRight: 4 }}
          >
            <Text style={{ fontSize: 13, fontWeight: activeTab === t.when ? '600' : '400', color: activeTab === t.when ? colors.accent : colors.textMuted }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filters bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => setSheetVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: activeCount > 0 ? colors.accent : colors.surface,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderWidth: 0.5,
            borderColor: activeCount > 0 ? colors.accent : colors.borderStrong,
          }}
        >
          <Ionicons name="options-outline" size={16} color={activeCount > 0 ? colors.accentDark : colors.textSecondary} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: activeCount > 0 ? colors.accentDark : colors.textSecondary }}>
            {activeCount > 0 ? `Filters · ${activeCount}` : 'Filters'}
          </Text>
        </TouchableOpacity>

        {activeCount > 0 && (
          <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Feed (curated rows on the default Today view, then the filtered list) */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}>
        {activeTab === 'today' && activeCount === 0 && <CuratedSections games={remote} />}

        <Text style={{ fontSize: 11, color: colors.textMuted, paddingHorizontal: 16, letterSpacing: 0.8, marginBottom: 8 }}>{tab.section}</Text>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {games.length === 0 ? (
            <EmptyFeed label={tab.label} />
          ) : (
            games.map((game) => <GameCard key={game.id} game={game} />)
          )}
        </View>
      </ScrollView>

      <FilterSheet
        visible={sheetVisible}
        initial={filters}
        countFor={(draft) => getFeedGames(remote, toGameFilters(activeTab, draft)).length}
        onClose={() => setSheetVisible(false)}
        onApply={(f) => {
          setFilters(f)
          setSheetVisible(false)
        }}
      />
    </View>
  )
}
