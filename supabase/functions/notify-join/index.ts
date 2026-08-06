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

  // Only fire on joins, not saves
  if (record.role !== 'joined') return new Response('ok')

  const [{ data: game }, { data: joiner }] = await Promise.all([
    supabase.from('games').select('title, sport, host_id').eq('id', record.game_id).single(),
    supabase.from('profiles').select('display_name').eq('id', record.user_id).single(),
  ])

  if (!game) return new Response('ok')
  // Don't notify if the host joined their own game
  if (game.host_id === record.user_id) return new Response('ok')

  const { data: host } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', game.host_id)
    .single()

  if (!host?.push_token) return new Response('ok')

  const name = joiner?.display_name || 'Someone'
  await sendPush([{
    to: host.push_token,
    title: 'New player joined! 🎉',
    body: `${name} joined your ${game.sport} game — ${game.title}`,
  }])

  return new Response('ok')
})
