import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Lets the web popup close itself once the OAuth redirect lands.
WebBrowser.maybeCompleteAuthSession()

export type OAuthProvider = 'google' | 'apple'

// Sign in with a third-party provider via the browser-based OAuth flow.
//
// - Web: a full-page redirect to the provider and back; `detectSessionInUrl`
//   (enabled in supabase.ts for web) finishes the session on return.
// - Native: open the provider URL in an auth session, then exchange the `code`
//   from the deep-link redirect for a session (PKCE — the code verifier is held
//   in the client's AsyncStorage between the two calls).
//
// Requires the provider to be enabled in the Supabase dashboard with valid
// OAuth credentials, and the redirect URLs allow-listed (see
// docs/social-auth-setup.md). Until then this returns a "provider is not
// enabled" error from Supabase.
export async function signInWithProvider(provider: OAuthProvider): Promise<{ error: string | null }> {
  try {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      })
      return { error: error?.message ?? null }
    }

    const redirectTo = Linking.createURL('auth-callback')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error) return { error: error.message }
    if (!data?.url) return { error: 'Could not start sign-in.' }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success') return { error: null } // dismissed / cancelled

    const { queryParams } = Linking.parse(result.url)
    const code = queryParams?.code
    if (typeof code === 'string') {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) return { error: exchangeError.message }
    }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sign-in failed.' }
  }
}
