import { supabase } from './supabase'
import type { Message } from '../types/message'

// A row from the `messages` table, with the sender's profile embedded via the
// messages_sender_id_fkey foreign key for display (name + avatar).
type MessageRow = {
  id: string
  sender_id: string
  text: string
  created_at: string
  sender: { display_name: string; avatar_emoji: string } | null
}

const SELECT = '*, sender:profiles!messages_sender_id_fkey(display_name, avatar_emoji)'

function mapRowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender?.display_name || 'Someone',
    avatarEmoji: row.sender?.avatar_emoji ?? '',
    text: row.text,
    timestamp: new Date(row.created_at).getTime(),
  }
}

// A game's chat history, oldest first. Returns [] on error.
export async function fetchMessages(gameId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(SELECT)
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as MessageRow[]).map(mapRowToMessage)
}

// Post a message to a game's chat. RLS requires senderId === the auth user and
// that they've joined the game (or host it).
export async function sendMessage(gameId: string, senderId: string, text: string): Promise<{ error: string | null }> {
  const body = text.trim()
  if (!body) return { error: null }
  const { error } = await supabase.from('messages').insert({ game_id: gameId, sender_id: senderId, text: body })
  return { error: error?.message ?? null }
}

// Subscribe to new messages for a game via Realtime. `onInsert` fires on each
// inserted row (including the caller's own). Returns an unsubscribe function.
export function subscribeToGameMessages(gameId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`messages:${gameId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `game_id=eq.${gameId}` },
      () => onInsert(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
