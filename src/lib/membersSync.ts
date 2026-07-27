import { supabase } from './supabase'

// A membership row from the `game_members` table: a user's relationship to a
// game. 'saved' = hearted for later; 'joined' = grabbed a spot.
export type MemberRole = 'joined' | 'saved'

export type MemberRow = {
  game_id: string
  user_id: string
  role: MemberRole
}

// Every membership row (public read). Used to derive the current user's saves
// and joins plus the joined-count per game. Returns [] on error so the caller
// keeps whatever it had.
export async function fetchAllMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase.from('game_members').select('game_id, user_id, role')
  if (error || !data) return []
  return data as MemberRow[]
}

// Add a membership. The (game_id, user_id, role) unique constraint makes this a
// no-op if it already exists, so a double-tap won't error.
export async function insertMembership(userId: string, gameId: string, role: MemberRole): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('game_members')
    .upsert({ user_id: userId, game_id: gameId, role }, { onConflict: 'game_id,user_id,role' })
  return { error: error?.message ?? null }
}

// Remove a membership (unsave or leave).
export async function deleteMembership(userId: string, gameId: string, role: MemberRole): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('game_members')
    .delete()
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .eq('role', role)
  return { error: error?.message ?? null }
}

// Subscribe to all membership changes via Realtime so joined counts / spots-left
// update live when anyone (any user) joins or leaves — not just on reload.
// `onChange` fires on every insert/update/delete; the caller re-fetches. Returns
// an unsubscribe function.
export function subscribeToMembers(onChange: () => void): () => void {
  const channel = supabase
    .channel('game_members:all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_members' }, () => onChange())
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
