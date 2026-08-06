import type { Difficulty, Game, GameStatus } from '../types/game'
import { DIFFICULTY_OPTIONS } from './difficulty'
import { setRemoteGames } from './store'
import { supabase } from './supabase'

// A row from the Supabase `games` table, with the host's profile embedded as
// `organizer` via the games_host_id_fkey foreign key.
type GameRow = {
  id: string
  host_id: string
  title: string
  sport: string
  difficulty: string
  tags: string[]
  venue_name: string
  venue_area: string
  venue_lat: number
  venue_lng: number
  starts_at: string
  ends_at: string | null
  start_time: string
  price: string
  status: string
  image_url: string | null
  image_fallback: string
  spots: number
  spots_left: number
  featured: boolean
  organizer: { display_name: string; avatar_emoji: string } | null
}

// Columns to fetch, including the embedded host profile as `organizer`.
const SELECT = '*, organizer:profiles!games_host_id_fkey(display_name, avatar_emoji)'

const STATUSES: GameStatus[] = ['live', 'upcoming', 'open']

function toDifficulty(raw: string): Difficulty {
  return DIFFICULTY_OPTIONS.includes(raw as Difficulty) ? (raw as Difficulty) : 'open'
}

function toStatus(raw: string): GameStatus {
  return STATUSES.includes(raw as GameStatus) ? (raw as GameStatus) : 'open'
}

// DB row → app Game.
export function mapRowToGame(row: GameRow): Game {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    sport: row.sport,
    difficulty: toDifficulty(row.difficulty),
    tags: row.tags ?? [],
    venue: { name: row.venue_name, area: row.venue_area, lat: row.venue_lat, lng: row.venue_lng },
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    startTime: row.start_time,
    price: row.price,
    status: toStatus(row.status),
    imageUrl: row.image_url ?? undefined,
    imageFallback: row.image_fallback,
    spots: row.spots,
    spotsLeft: row.spots_left,
    featured: row.featured,
    organizer: row.organizer
      ? { name: row.organizer.display_name || 'Host', avatarEmoji: row.organizer.avatar_emoji || '' }
      : undefined,
  }
}

// The fields a host provides when creating or editing a game (everything except
// server-managed identity, ownership and the embedded organizer).
export type GameInput = {
  title: string
  sport: string
  difficulty: Difficulty
  tags: string[]
  venue: { name: string; area: string; lat: number; lng: number }
  startsAt: string
  endsAt?: string
  startTime: string
  // Public URL of the host's uploaded photo. Undefined means "no photo" — the
  // card falls back to imageFallback.
  imageUrl?: string
  price: string
  status: GameStatus
  imageFallback: string
  featured: boolean
  spots: number
  spotsLeft: number
}

function toColumns(input: GameInput) {
  return {
    title: input.title,
    sport: input.sport,
    difficulty: input.difficulty,
    tags: input.tags,
    venue_name: input.venue.name,
    venue_area: input.venue.area,
    venue_lat: input.venue.lat,
    venue_lng: input.venue.lng,
    starts_at: input.startsAt,
    // null (not undefined) so clearing these on edit actually wipes them.
    ends_at: input.endsAt ?? null,
    image_url: input.imageUrl ?? null,
    start_time: input.startTime,
    price: input.price,
    status: input.status,
    image_fallback: input.imageFallback,
    featured: input.featured,
    spots: input.spots,
    spots_left: input.spotsLeft,
  }
}

// Fetch every game, newest first. Returns [] on error (caller keeps what it had).
export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase.from('games').select(SELECT).order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as GameRow[]).map(mapRowToGame)
}

// Fetch games and push them into the store. Safe to call repeatedly.
export async function loadGames() {
  setRemoteGames(await fetchGames())
}

// Insert a new game owned by userId. Returns the created Game (with its real id).
export async function insertGame(userId: string, input: GameInput): Promise<{ game: Game | null; error: string | null }> {
  const { data, error } = await supabase
    .from('games')
    .insert({ host_id: userId, ...toColumns(input) })
    .select(SELECT)
    .single()
  if (error || !data) return { game: null, error: error?.message ?? 'Could not create game.' }
  return { game: mapRowToGame(data as GameRow), error: null }
}

// Update an existing game. Returns the updated Game.
export async function updateGame(id: string, input: GameInput): Promise<{ game: Game | null; error: string | null }> {
  const { data, error } = await supabase
    .from('games')
    .update(toColumns(input))
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error || !data) return { game: null, error: error?.message ?? 'Could not save changes.' }
  return { game: mapRowToGame(data as GameRow), error: null }
}

// Delete (cancel) a game.
export async function deleteGame(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('games').delete().eq('id', id)
  return { error: error?.message ?? null }
}
