import type { Profile } from '../types/profile'
import { supabase } from './supabase'

// The shape of a row in the Supabase `profiles` table (snake_case columns).
type ProfileRow = {
  id: string
  display_name: string
  handle: string
  bio: string
  home_area: string
  favorite_sports: string[]
  avatar_emoji: string
}

// DB row → app Profile.
export function mapRowToProfile(row: ProfileRow): Profile {
  return {
    displayName: row.display_name ?? '',
    handle: row.handle ?? '',
    bio: row.bio ?? '',
    homeArea: row.home_area ?? '',
    favoriteSports: row.favorite_sports ?? [],
    avatarEmoji: row.avatar_emoji ?? '',
  }
}

// Fetch the signed-in user's profile. Returns null when they haven't created
// one yet (no row), or on error (caller keeps whatever it already had).
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return mapRowToProfile(data as ProfileRow)
}

// Upsert the app Profile to the `profiles` table for the given user.
export async function upsertProfile(userId: string, profile: Profile) {
  return supabase.from('profiles').upsert({
    id: userId,
    display_name: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    home_area: profile.homeArea,
    favorite_sports: profile.favoriteSports,
    avatar_emoji: profile.avatarEmoji,
    updated_at: new Date().toISOString(),
  })
}
