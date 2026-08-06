import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import React from 'react'
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native'
import { formatGameDate, formatVenueLabel } from '../../src/lib/games'
import { useJoinedIds, useMyGames, useProfile, useSavedIds } from '../../src/lib/store'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'
import type { Profile } from '../../src/types/profile'

// Colored-initials fallback when no avatar emoji is picked.
export function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function Avatar({ profile, size = 88 }: { profile: Profile; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: profile.avatarEmoji ? colors.surface2 : colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: colors.borderStrong,
      }}
    >
      {profile.avatarEmoji ? (
        <Text style={{ fontSize: size * 0.5 }}>{profile.avatarEmoji}</Text>
      ) : (
        <Text style={{ fontSize: size * 0.34, fontWeight: '600', color: colors.accentDark }}>
          {initialsFor(profile.displayName) || '?'}
        </Text>
      )}
    </View>
  )
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingVertical: 14,
        borderWidth: 0.5,
        borderColor: colors.borderStrong,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '600', color: colors.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  )
}

function EmptyProfile() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Ionicons name="person-outline" size={28} color={colors.textMuted} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 }}>Create your profile</Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
        Tell other players who you are — your sports, your area, your level. It only takes a minute.
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/edit-profile')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.accent,
          borderRadius: 12,
          paddingHorizontal: 24,
          paddingVertical: 13,
        }}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.accentDark} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accentDark }}>Create profile</Text>
      </TouchableOpacity>
    </View>
  )
}

function ProfileView({ profile }: { profile: Profile }) {
  const joinedCount = useJoinedIds().length
  const savedCount = useSavedIds().length
  const hosted = useMyGames()

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      {/* Identity */}
      <View style={{ alignItems: 'center', paddingTop: 16, marginBottom: 20 }}>
        <Avatar profile={profile} />
        <Text style={{ fontSize: 22, fontWeight: '600', color: colors.textPrimary, marginTop: 12 }}>{profile.displayName}</Text>
        {profile.handle.length > 0 && (
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>@{profile.handle}</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          {profile.homeArea.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: colors.borderStrong }}>
              <Ionicons name="location-outline" size={10} color={colors.textSecondary} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>{profile.homeArea}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <StatBox value={joinedCount} label="Joined" />
        <StatBox value={savedCount} label="Saved" />
        <StatBox value={hosted.length} label="Hosted" />
      </View>

      {/* Bio */}
      {profile.bio.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 8 }}>ABOUT</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.borderStrong }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>{profile.bio}</Text>
          </View>
        </View>
      )}

      {/* Favorite sports */}
      {profile.favoriteSports.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 8 }}>FAVORITE SPORTS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {profile.favoriteSports.map((sport) => (
              <View key={sport} style={{ backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.borderStrong }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{sport}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {hosted.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 8 }}>YOUR GAMES</Text>
          <View style={{ gap: 10 }}>
            {hosted.map((game) => (
              <TouchableOpacity
                key={game.id}
                onPress={() => router.push(`/game/${game.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.borderStrong }}
              >
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{game.title}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{formatVenueLabel(game)}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                    {formatGameDate(game)} · {game.startTime} · {game.spotsLeft}/{game.spots} spots
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={() => router.push('/edit-profile')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: colors.surface,
          borderRadius: 12,
          paddingVertical: 14,
          borderWidth: 0.5,
          borderColor: colors.borderStrong,
          marginBottom: 10,
        }}
      >
        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Edit profile</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => supabase.auth.signOut()}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 12,
          paddingVertical: 14,
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textMuted }}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

export default function ProfileScreen() {
  const profile = useProfile()

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      <View style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 }}>
        <Text style={{ fontSize: 26, fontWeight: '500', color: colors.textPrimary }}>
          pickup<Text style={{ color: colors.accent }}>.</Text>
        </Text>
      </View>

      {profile ? <ProfileView profile={profile} /> : <EmptyProfile />}
    </View>
  )
}
