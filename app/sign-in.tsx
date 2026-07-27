import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { signInWithProvider, type OAuthProvider } from '../src/lib/socialAuth'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/theme'

type Mode = 'sign-in' | 'sign-up'

export default function SignInScreen() {
  const [mode, setMode] = React.useState<Mode>('sign-in')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [providerLoading, setProviderLoading] = React.useState<OAuthProvider | null>(null)
  const [error, setError] = React.useState('')

  async function handleProvider(provider: OAuthProvider) {
    setProviderLoading(provider)
    setError('')
    const { error: err } = await signInWithProvider(provider)
    if (err) setError(err)
    setProviderLoading(null)
  }

  async function handleSubmit() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) return
    setLoading(true)
    setError('')

    if (mode === 'sign-up') {
      const { error: err } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
    }
    setLoading(false)
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Text style={{ fontSize: 36, fontWeight: '500', color: colors.textPrimary }}>
              pickup<Text style={{ color: colors.accent }}>.</Text>
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>
              Find your next game
            </Text>
          </View>

          {error !== '' && (
            <View
              style={{
                backgroundColor: 'rgba(255,59,48,0.15)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                borderWidth: 0.5,
                borderColor: colors.live,
              }}
            >
              <Text style={{ fontSize: 13, color: colors.live }}>{error}</Text>
            </View>
          )}

          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 8 }}>EMAIL</Text>
            <View
              style={{
                backgroundColor: colors.surface2,
                borderRadius: 12,
                paddingHorizontal: 12,
                borderWidth: 0.5,
                borderColor: colors.borderStrong,
              }}
            >
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{ fontSize: 14, color: colors.textPrimary, paddingVertical: 12 }}
              />
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 8 }}>PASSWORD</Text>
            <View
              style={{
                backgroundColor: colors.surface2,
                borderRadius: 12,
                paddingHorizontal: 12,
                borderWidth: 0.5,
                borderColor: colors.borderStrong,
              }}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={{ fontSize: 14, color: colors.textPrimary, paddingVertical: 12 }}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !email.trim() || !password}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: email.trim() && password ? colors.accent : colors.surface2,
              borderRadius: 12,
              paddingVertical: 14,
              marginBottom: 16,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.accentDark} />
            ) : (
              <>
                <Ionicons
                  name={mode === 'sign-up' ? 'person-add-outline' : 'log-in-outline'}
                  size={18}
                  color={email.trim() && password ? colors.accentDark : colors.textMuted}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: email.trim() && password ? colors.accentDark : colors.textMuted,
                  }}
                >
                  {mode === 'sign-up' ? 'Create account' : 'Sign in'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8 }}>OR</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: colors.border }} />
          </View>

          {/* Social sign-in */}
          {([
            { provider: 'google', label: 'Continue with Google', icon: 'logo-google' },
            { provider: 'apple', label: 'Continue with Apple', icon: 'logo-apple' },
          ] as const).map(({ provider, label, icon }) => (
            <TouchableOpacity
              key={provider}
              onPress={() => handleProvider(provider)}
              disabled={providerLoading !== null || loading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.surface2,
                borderRadius: 12,
                paddingVertical: 14,
                marginBottom: 10,
                borderWidth: 0.5,
                borderColor: colors.borderStrong,
              }}
            >
              {providerLoading === provider ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name={icon} size={18} color={colors.textPrimary} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{label}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
              setError('')
            }}
            style={{ alignItems: 'center', paddingVertical: 8, marginTop: 6 }}
          >
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={{ color: colors.accent, fontWeight: '500' }}>
                {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
