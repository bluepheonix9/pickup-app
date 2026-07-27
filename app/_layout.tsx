import { Stack } from 'expo-router'
import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '../src/lib/auth'
import { loadGames } from '../src/lib/gamesSync'
import { fetchProfile } from '../src/lib/profileSync'
import { clearMembers, clearProfile, loadMembers, loadStateFromStorage, saveProfile, setCurrentUser } from '../src/lib/store'
import { colors } from '../src/theme'

function RootNavigator() {
  const { session, loading, user } = useAuth()

  React.useEffect(() => {
    loadStateFromStorage()
  }, [])

  // Hydrate the profile from Supabase as the source of truth: pull it on sign-in
  // (overwriting the local cache), and clear it on sign-out so the next user
  // doesn't inherit the previous one's profile. Keyed on the user id so periodic
  // token refreshes don't re-fetch.
  const userId = user?.id
  React.useEffect(() => {
    setCurrentUser(userId ?? null)
    if (!userId) {
      clearProfile()
      clearMembers()
      return
    }
    let cancelled = false
    fetchProfile(userId).then((profile) => {
      if (!cancelled && profile) saveProfile(profile)
    })
    void loadGames()
    void loadMembers()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      {/* Protected routes: when `guard` flips false, Expo Router redirects away
          from any active protected screen to the anchor route. This is what
          actually navigates the user in/out on sign-in and sign-out — declaring
          screens conditionally only swaps options, it never redirects. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="host-game" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pick-venue" options={{ animation: 'slide_from_bottom' }} />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Screen name="+not-found" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}
