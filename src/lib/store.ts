import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { deleteMembership, fetchAllMembers, insertMembership } from './membersSync'
import type { Game } from '../types/game'
import type { Message } from '../types/message'
import type { Profile } from '../types/profile'

// Lightweight app store for the demo core loop — saves and joins that stay in
// sync across the Home feed, game detail, and the Saved tab. Dependency-free
// on state management: a tiny external store read through useSyncExternalStore.
// Games and memberships now live in Supabase: `remoteGames` and the
// saved/joined membership state are fetched on sign-in. profile is persisted to
// AsyncStorage as an offline cache; chat is in-memory only for now.

type StoreState = {
  // The current user's saved / joined game ids (their own game_members rows).
  savedIds: string[]
  joinedIds: string[]
  // How many people have joined each game (all users), keyed by game id — used
  // to show real, live spots-left counts.
  joinedCountByGame: Record<string, number>
  // null until the user creates their profile.
  profile: Profile | null
  // All games fetched from Supabase (everyone's, not just the current user's).
  remoteGames: Game[]
  // Auth user id of the signed-in user, used to tell which games are "mine".
  currentUserId: string | null
  // Per-game chat threads, keyed by game id. In-memory only for now.
  gameChats: Record<string, Message[]>
}

let state: StoreState = {
  savedIds: [],
  joinedIds: [],
  joinedCountByGame: {},
  profile: null,
  remoteGames: [],
  currentUserId: null,
  gameChats: {},
}

const listeners = new Set<() => void>()

function setState(next: Partial<StoreState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
  if ('profile' in next) void persistState()
}

// ---- Persistence (AsyncStorage) ----

const STORAGE_KEY_PROFILE = 'pickup_profile'

async function persistState() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(state.profile))
  } catch {
    // Best-effort: a failed write just means this change isn't persisted.
  }
}

export async function saveStateToStorage() {
  await persistState()
}

// Hydrate the profile from disk. Corrupt or missing values fall back to the
// in-memory defaults. Call once on app startup.
export async function loadStateFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PROFILE)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') setState({ profile: parsed })
    }
  } catch {
    // Corrupt data → keep defaults.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ---- Selectors (hooks) ----

export function useSavedIds(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => state.savedIds,
    () => state.savedIds,
  )
}

export function useJoinedIds(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => state.joinedIds,
    () => state.joinedIds,
  )
}

export function useIsSaved(id: string): boolean {
  return useSavedIds().includes(id)
}

export function useIsJoined(id: string): boolean {
  return useJoinedIds().includes(id)
}

// How many people have joined a given game (all users).
export function useJoinedCount(id: string): number {
  return useSyncExternalStore(
    subscribe,
    () => state.joinedCountByGame[id] ?? 0,
    () => state.joinedCountByGame[id] ?? 0,
  )
}

// All games from the backend (feed + map).
export function useRemoteGames(): Game[] {
  return useSyncExternalStore(
    subscribe,
    () => state.remoteGames,
    () => state.remoteGames,
  )
}

// Non-hook read for plain lib code (e.g. getGameById outside React).
export function getRemoteGames(): Game[] {
  return state.remoteGames
}

// Memoized "games I host" so getSnapshot returns a stable reference until the
// underlying games list or the signed-in user changes.
let myGamesCache: { games: Game[]; userId: string | null; result: Game[] } | null = null
function selectMyGames(): Game[] {
  if (!myGamesCache || myGamesCache.games !== state.remoteGames || myGamesCache.userId !== state.currentUserId) {
    const result = state.currentUserId
      ? state.remoteGames.filter((game) => game.hostId === state.currentUserId)
      : []
    myGamesCache = { games: state.remoteGames, userId: state.currentUserId, result }
  }
  return myGamesCache.result
}

// Games hosted by the signed-in user (Profile "your games").
export function useMyGames(): Game[] {
  return useSyncExternalStore(subscribe, selectMyGames, selectMyGames)
}

export function useIsHosted(id: string): boolean {
  return selectMyGames().some((game) => game.id === id)
}

export function useProfile(): Profile | null {
  return useSyncExternalStore(
    subscribe,
    () => state.profile,
    () => state.profile,
  )
}

// Stable empty reference so an unread thread doesn't churn getSnapshot.
const EMPTY_MESSAGES: Message[] = []

export function useGameMessages(gameId: string): Message[] {
  return useSyncExternalStore(
    subscribe,
    () => state.gameChats[gameId] ?? EMPTY_MESSAGES,
    () => state.gameChats[gameId] ?? EMPTY_MESSAGES,
  )
}

// ---- Actions ----

// Saves and joins write to Supabase `game_members`. Each action updates local
// state immediately (optimistic) so the UI is snappy, fires the DB write, and
// rolls back if it fails.

export function toggleSaved(id: string) {
  const userId = state.currentUserId
  const isSaved = state.savedIds.includes(id)
  const prev = state.savedIds

  setState({ savedIds: isSaved ? prev.filter((s) => s !== id) : [id, ...prev] })
  if (!userId) return

  const write = isSaved ? deleteMembership(userId, id, 'saved') : insertMembership(userId, id, 'saved')
  void write.then(({ error }) => {
    if (error) setState({ savedIds: prev })
  })
}

export function joinGame(id: string) {
  const userId = state.currentUserId
  if (state.joinedIds.includes(id)) return
  const prevJoined = state.joinedIds
  const prevCounts = state.joinedCountByGame

  setState({
    joinedIds: [...prevJoined, id],
    joinedCountByGame: { ...prevCounts, [id]: (prevCounts[id] ?? 0) + 1 },
  })
  if (!userId) return

  void insertMembership(userId, id, 'joined').then(({ error }) => {
    if (error) setState({ joinedIds: prevJoined, joinedCountByGame: prevCounts })
  })
}

export function leaveGame(id: string) {
  const userId = state.currentUserId
  if (!state.joinedIds.includes(id)) return
  const prevJoined = state.joinedIds
  const prevCounts = state.joinedCountByGame

  setState({
    joinedIds: prevJoined.filter((j) => j !== id),
    joinedCountByGame: { ...prevCounts, [id]: Math.max(0, (prevCounts[id] ?? 1) - 1) },
  })
  if (!userId) return

  void deleteMembership(userId, id, 'joined').then(({ error }) => {
    if (error) setState({ joinedIds: prevJoined, joinedCountByGame: prevCounts })
  })
}

// Fetch every membership and rebuild the current user's saves/joins plus the
// per-game joined counts. Safe to call repeatedly (e.g. on sign-in).
export async function loadMembers() {
  const rows = await fetchAllMembers()
  const userId = state.currentUserId
  const savedIds: string[] = []
  const joinedIds: string[] = []
  const joinedCountByGame: Record<string, number> = {}

  for (const row of rows) {
    if (row.role === 'joined') {
      joinedCountByGame[row.game_id] = (joinedCountByGame[row.game_id] ?? 0) + 1
      if (row.user_id === userId) joinedIds.push(row.game_id)
    } else if (row.role === 'saved' && row.user_id === userId) {
      savedIds.push(row.game_id)
    }
  }

  setState({ savedIds, joinedIds, joinedCountByGame })
}

// Wipe membership state on sign-out so the next user starts clean.
export function clearMembers() {
  setState({ savedIds: [], joinedIds: [], joinedCountByGame: {} })
}

// Set who's signed in, so "my games" / host controls resolve correctly.
export function setCurrentUser(userId: string | null) {
  if (state.currentUserId === userId) return
  setState({ currentUserId: userId })
}

// Replace the games list with a fresh fetch from the backend.
export function setRemoteGames(games: Game[]) {
  setState({ remoteGames: games })
}

// Add a newly created game, or replace it in place if it already exists (edit).
export function upsertLocalGame(game: Game) {
  const existed = state.remoteGames.some((g) => g.id === game.id)
  // Keep an edited game in its original position; put a brand-new one on top.
  setState({
    remoteGames: existed
      ? state.remoteGames.map((g) => (g.id === game.id ? game : g))
      : [game, ...state.remoteGames],
  })
}

// Remove a cancelled game and scrub any references so it stops resolving.
// (The game_members rows are cleaned up server-side by the games FK cascade.)
export function removeLocalGame(id: string) {
  const { [id]: _removed, ...remainingChats } = state.gameChats
  const { [id]: _count, ...remainingCounts } = state.joinedCountByGame
  setState({
    remoteGames: state.remoteGames.filter((game) => game.id !== id),
    savedIds: state.savedIds.filter((savedId) => savedId !== id),
    joinedIds: state.joinedIds.filter((joinedId) => joinedId !== id),
    joinedCountByGame: remainingCounts,
    gameChats: remainingChats,
  })
}

// Blank slate merged under partial saves when no profile exists yet.
const EMPTY_PROFILE: Profile = {
  displayName: '',
  handle: '',
  bio: '',
  homeArea: '',
  favoriteSports: [],
  skillLevel: 'beginner',
  avatarEmoji: '',
}

// Create-or-update: merges the patch over the existing profile (or a blank
// one), so the editor can save the whole form or a single field.
export function saveProfile(patch: Partial<Profile>) {
  const base = state.profile ?? EMPTY_PROFILE
  setState({ profile: { ...base, ...patch } })
}

export function clearProfile() {
  setState({ profile: null })
}

// Append a message to a game's thread, stamped with the current profile
// (falling back to a guest identity when no profile exists yet).
export function sendGameMessage(gameId: string, text: string) {
  const body = text.trim()
  if (!body) return
  const profile = state.profile
  const message: Message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderId: profile?.handle || 'me',
    senderName: profile?.displayName || 'You',
    avatarEmoji: profile?.avatarEmoji || '',
    text: body,
    timestamp: Date.now(),
  }
  const thread = state.gameChats[gameId] ?? EMPTY_MESSAGES
  setState({ gameChats: { ...state.gameChats, [gameId]: [...thread, message] } })
}

// ---- Derived helpers ----

// Real spots left: the game's baseline availability minus everyone who has
// joined through the app. `joinedCount` comes from useJoinedCount(game.id).
export function effectiveSpotsLeft(game: Game, joinedCount: number): number {
  return Math.max(0, game.spotsLeft - joinedCount)
}
