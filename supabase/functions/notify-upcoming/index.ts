import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type PushMessage = { to: string; title: string; body: string }

async function sendPush(messages: PushMessage[]) {
  if (messages.length === 0) return
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })
}

async function tokensForGame(gameId: string, hostId: string, excludeUserId?: string): Promise<string[]> {
  const [{ data: members }, { data: host }] = await Promise.all([
    supabase
      .from('game_members')
      .select('profiles(push_token)')
      .eq('game_id', gameId)
      .eq('role', 'joined'),
    supabase.from('profiles').select('push_token').eq('id', hostId).single(),
  ])

  const tokens = new Set<string>()
  for (const m of members ?? []) {
    const token = (m.profiles as { push_token: string | null } | null)?.push_token
    if (token) tokens.add(token)
  }
  if (host?.push_token) tokens.add(host.push_token)
  if (excludeUserId) tokens.delete(excludeUserId)
  return [...tokens]
}

Deno.serve(async (_req: Request) => {
  const now = new Date()

  const dayBeforeLow = new Date(now.getTime() + 23.5 * 3600_000)
  const dayBeforeHigh = new Date(now.getTime() + 24.5 * 3600_000)
  const hourBeforeLow = new Date(now.getTime() + 30 * 60_000)
  const hourBeforeHigh = new Date(now.getTime() + 90 * 60_000)

  const [{ data: dayGames }, { data: hourGames }] = await Promise.all([
    supabase
      .from('games')
      .select('id, title, sport, venue_name, venue_area, start_time, host_id')
      .gte('starts_at', dayBeforeLow.toISOString())
      .lte('starts_at', dayBeforeHigh.toISOString()),
    supabase
      .from('games')
      .select('id, title, sport, venue_name, venue_area, start_time, host_id')
      .gte('starts_at', hourBeforeLow.toISOString())
      .lte('starts_at', hourBeforeHigh.toISOString()),
  ])

  const pushMessages: PushMessage[] = []

  await Promise.all([
    ...(dayGames ?? []).map(async (g) => {
      const tokens = await tokensForGame(g.id, g.host_id)
      for (const to of tokens) {
        pushMessages.push({
          to,
          title: 'Game tomorrow! 📅',
          body: `Your ${g.sport} game "${g.title}" is tomorrow ${g.start_time} at ${g.venue_area}`,
        })
      }
    }),
    ...(hourGames ?? []).map(async (g) => {
      const tokens = await tokensForGame(g.id, g.host_id)
      for (const to of tokens) {
        pushMessages.push({
          to,
          title: 'Starting in 1 hour! ⏰',
          body: `Your ${g.sport} game "${g.title}" starts soon at ${g.venue_name}`,
        })
      }
    }),
  ])

  await sendPush(pushMessages)

  return new Response(JSON.stringify({ sent: pushMessages.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
