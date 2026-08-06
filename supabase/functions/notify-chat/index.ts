import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function sendPush(messages: { to: string; title: string; body: string }[]) {
  if (messages.length === 0) return
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })
}

Deno.serve(async (req: Request) => {
  const { record } = await req.json()

  const [{ data: game }, { data: sender }] = await Promise.all([
    supabase.from('games').select('title, sport, host_id').eq('id', record.game_id).single(),
    supabase.from('profiles').select('display_name').eq('id', record.sender_id).single(),
  ])

  if (!game) return new Response('ok')

  // Collect push tokens of all joined members (excluding sender)
  const { data: members } = await supabase
    .from('game_members')
    .select('user_id, profiles(push_token)')
    .eq('game_id', record.game_id)
    .eq('role', 'joined')
    .neq('user_id', record.sender_id)

  const tokens = new Set<string>()
  for (const m of members ?? []) {
    const token = (m.profiles as { push_token: string | null } | null)?.push_token
    if (token) tokens.add(token)
  }

  // Also notify the host if they're not the sender
  if (game.host_id !== record.sender_id) {
    const { data: host } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', game.host_id)
      .single()
    if (host?.push_token) tokens.add(host.push_token)
  }

  if (tokens.size === 0) return new Response('ok')

  const senderName = sender?.display_name || 'Someone'
  const preview = record.text.length > 60 ? record.text.slice(0, 60) + '…' : record.text

  await sendPush([...tokens].map((to) => ({
    to,
    title: `${senderName} in ${game.sport} chat`,
    body: preview,
  })))

  return new Response('ok')
})
