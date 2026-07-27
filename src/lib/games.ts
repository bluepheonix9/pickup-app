import { getRemoteGames } from './store'
import type { Game, GameFilters, TimeWindow } from '../types/game'

// Query/derive helpers over the games list. Games live in Supabase and are held
// in the store's `remoteGames`; screens read them reactively via
// `useRemoteGames()` and pass the list into these pure functions.

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Does a game fall inside the given time window, relative to `now`?
// Non-overlapping by calendar day:
// - today:    same calendar day as now
// - upcoming: any day after today
// - past:     any day before today
function matchesWhen(game: Game, when: TimeWindow, now = new Date()): boolean {
  const startDay = startOfDay(new Date(game.startsAt)).getTime()
  const today = startOfDay(now).getTime()

  if (when === 'today') return startDay === today
  if (when === 'upcoming') return startDay > today
  return startDay < today
}

const BROWSE_TAGS = ['Outdoor', 'Indoor', 'Social', 'Casual', 'Beach', 'Court']

// Curated option lists for the create/edit forms (host a game, profile). These
// are the sports/areas the app offers — fixed, independent of what games happen
// to exist right now. (The Filters sheet, by contrast, derives its options from
// the live games via getSports/getAreas so no filter ever returns zero.)
export const SPORT_OPTIONS = [
  'Basketball',
  'Soccer',
  'Volleyball',
  'Tennis',
  'Touch Footy',
  'Netball',
  'Cricket',
  'Running',
]

export const AREA_OPTIONS = [
  'Bondi',
  'Centennial Park',
  'Manly',
  'Newtown',
  'Rushcutters Bay',
  'Alexandria',
  'Rozelle',
  'Surry Hills',
  'Parramatta',
]

function isFree(game: Game): boolean {
  return game.price.trim().toLowerCase() === 'free'
}

// A game plots on the map only if it has real coordinates. Games hosted without
// the venue picker are stored at 0,0 — filter those out so they don't land in
// the ocean off West Africa.
function hasRealLocation(game: Game): boolean {
  return game.venue.lat !== 0 || game.venue.lng !== 0
}

function applyFilters(games: Game[], filters?: GameFilters): Game[] {
  if (!filters) return games

  return games.filter((game) => {
    if (filters.ids && !filters.ids.includes(game.id)) return false
    if (filters.area && filters.area !== 'All areas' && game.venue.area !== filters.area) return false
    if (filters.sport && filters.sport !== 'All sports' && game.sport !== filters.sport) return false
    if (filters.difficulty && game.difficulty !== filters.difficulty) return false
    if (filters.status && game.status !== filters.status) return false
    if (filters.featured && !game.featured) return false
    if (filters.when && !matchesWhen(game, filters.when)) return false
    if (filters.tag && !game.tags.includes(filters.tag)) return false
    if (filters.price === 'free' && !isFree(game)) return false
    if (filters.price === 'paid' && isFree(game)) return false
    return true
  })
}

// The main feed: the given games, filtered.
export function getFeedGames(games: Game[], filters?: GameFilters): Game[] {
  return applyFilters(games, filters)
}

// Look up a single game by id. Reads the current store snapshot, so it also
// works for non-React callers; React callers should still subscribe via
// `useRemoteGames()` so they re-render when the games list loads.
export function getGameById(id: string): Game | undefined {
  return getRemoteGames().find((game) => game.id === id)
}

// Games that have a real location, filtered — used by the map.
export function getGamesForMap(games: Game[], filters?: GameFilters): Game[] {
  return applyFilters(games.filter(hasRealLocation), filters)
}

export function getBrowseTags() {
  return BROWSE_TAGS
}

// Distinct sports/areas actually present in the data — used to build the
// Filters sheet so no filter option ever returns zero games.
export function getSports(games: Game[]): string[] {
  return Array.from(new Set(games.map((game) => game.sport)))
}

export function getAreas(games: Game[]): string[] {
  return Array.from(new Set(games.map((game) => game.venue.area)))
}

export function getVenues(games: Game[]) {
  const venueMap = new Map<string, { id: string; name: string; area: string; games: number }>()

  for (const game of games) {
    const key = game.venue.name
    const existing = venueMap.get(key)
    if (existing) {
      existing.games += 1
    } else {
      venueMap.set(key, {
        id: key.toLowerCase().replace(/\s+/g, '-'),
        name: game.venue.name,
        area: game.venue.area,
        games: 1,
      })
    }
  }

  return Array.from(venueMap.values())
}

export function getGameImageColor(game: Game): string {
  return game.imageFallback
}

export function formatVenueLabel(game: Game): string {
  return `${game.venue.name}, ${game.venue.area}`
}

export function formatGameDate(game: Game): string {
  return new Date(game.startsAt).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatGameDateLong(game: Game): string {
  return new Date(game.startsAt).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function isGameUpcoming(game: Game, now = new Date()): boolean {
  return new Date(game.startsAt) >= now
}

// True when the game's day is before today (used to exclude past games from
// the curated "browse" rows on Home).
export function isPastGame(game: Game, now = new Date()): boolean {
  return startOfDay(new Date(game.startsAt)).getTime() < startOfDay(now).getTime()
}

// ---- Curated sections (Home) ----

// Fallback origin for "near you" when the device location is unavailable
// (permission denied, or web without a granted prompt): central Sydney.
export const DEFAULT_LOCATION = { lat: -33.8908, lng: 151.2497 } // Bondi Junction

// Cheap planar distance — good enough to rank nearby venues within a city.
function distanceFrom(origin: { lat: number; lng: number }, game: Game): number {
  const dLat = game.venue.lat - origin.lat
  const dLng = game.venue.lng - origin.lng
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

// Non-past games, nearest first from `origin` (the device location when known,
// otherwise DEFAULT_LOCATION).
export function getNearbyGames(games: Game[], origin: { lat: number; lng: number } = DEFAULT_LOCATION, limit = 6): Game[] {
  return games
    .filter((game) => !isPastGame(game))
    .sort((a, b) => distanceFrom(origin, a) - distanceFrom(origin, b))
    .slice(0, limit)
}

// Featured games happening on the coming weekend (falls back to all featured
// upcoming games if none land on a weekend).
export function getFeaturedWeekendGames(games: Game[]): Game[] {
  const featured = games.filter((game) => game.featured && !isPastGame(game))
  const onWeekend = featured.filter((game) => {
    const day = new Date(game.startsAt).getDay()
    return day === 0 || day === 6
  })
  return onWeekend.length > 0 ? onWeekend : featured
}

// Non-past free games.
export function getFreeGames(games: Game[]): Game[] {
  return games.filter((game) => isFree(game) && !isPastGame(game))
}

// Full-text-ish search over title, sport, venue name and area.
export function searchGames(games: Game[], query: string): Game[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return games.filter((game) => {
    return (
      game.title.toLowerCase().includes(q) ||
      game.sport.toLowerCase().includes(q) ||
      game.venue.name.toLowerCase().includes(q) ||
      game.venue.area.toLowerCase().includes(q)
    )
  })
}
