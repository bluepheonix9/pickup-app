# Social sign-in setup (Google & Apple)

The app code for "Continue with Google / Apple" is implemented
([src/lib/socialAuth.ts](../src/lib/socialAuth.ts), wired into
[app/sign-in.tsx](../app/sign-in.tsx)) using Supabase's browser-based OAuth flow.
Until the steps below are done, tapping a provider button returns
**"Unsupported provider: provider is not enabled"** from Supabase — that error
confirms the client wiring is correct and only the provider config is missing.

## 1. Redirect URLs (both providers)

Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs**, add:

- `resona://auth-callback` — native (Expo dev build / standalone)
- `exp://…/auth-callback` — Expo Go during development (copy the exact `exp://`
  host from the Metro terminal if you test the browser flow in Expo Go)
- `http://localhost:8081` — local web
- your production web origin (when deployed)

The app derives the native redirect with `Linking.createURL('auth-callback')`
and uses `window.location.origin` on web.

## 2. Google

**Google Cloud Console** (https://console.cloud.google.com):
1. APIs & Services → Credentials → **Create OAuth client ID** → *Web application*.
2. Under **Authorized redirect URIs**, add the Supabase callback:
   `https://lgtqgcryodmbneykcwxz.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.

**Supabase Dashboard** → Authentication → Providers → **Google** → enable, paste
the Client ID + Client secret, save.

(For a native *ID-token* flow later — nicer UX, system account picker — you'd add
Android/iOS OAuth client IDs and switch to `@react-native-google-signin/google-signin`
+ `signInWithIdToken`. The current browser flow needs none of that.)

## 3. Apple

**Apple Developer** (needs a paid Apple Developer account):
1. Create an **App ID** with *Sign in with Apple* enabled.
2. Create a **Services ID** (this is the OAuth client id); enable Sign in with
   Apple and set the return URL to the Supabase callback:
   `https://lgtqgcryodmbneykcwxz.supabase.co/auth/v1/callback`
3. Create a **Key** with Sign in with Apple; note the Key ID + Team ID and
   download the `.p8`.

**Supabase Dashboard** → Authentication → Providers → **Apple** → enable, fill in
the Services ID (client id), Team ID, Key ID, and the `.p8` secret.

> App Store note: for a production **iOS** build, Apple requires *native* Sign in
> with Apple (`expo-apple-authentication` + `supabase.auth.signInWithIdToken`)
> when you also offer other social logins. The browser flow here is fine for
> Android / web / development; add the native Apple button before iOS submission.

## 4. Testing

- **Web**: run the dev server, click "Continue with Google" → redirects to Google
  → back to the app signed in. `detectSessionInUrl` (already enabled for web in
  [src/lib/supabase.ts](../src/lib/supabase.ts)) completes the session.
- **Native**: requires an Expo **dev build** (the browser-based flow works in Expo
  Go too, but deep-link redirects are most reliable in a dev/standalone build).
  Tapping the button opens the provider in a web auth session and returns via
  `resona://auth-callback`; the app exchanges the code for a session (PKCE).
