import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../lib/auth'
import { fetchMessages, sendMessage, subscribeToGameMessages } from '../lib/chatSync'
import { colors } from '../theme'
import type { Message } from '../types/message'

function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function Avatar({ message }: { message: Message }) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: message.avatarEmoji ? colors.surface2 : colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {message.avatarEmoji ? (
        <Text style={{ fontSize: 16 }}>{message.avatarEmoji}</Text>
      ) : (
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accentDark }}>
          {initialsFor(message.senderName) || '?'}
        </Text>
      )}
    </View>
  )
}

function MessageRow({ message }: { message: Message }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
      <Avatar message={message} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>{message.senderName}</Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>{formatTimestamp(message.timestamp)}</Text>
        </View>
        <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 19 }}>{message.text}</Text>
      </View>
    </View>
  )
}

export function GameChat({ gameId }: { gameId: string }) {
  const { user } = useAuth()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [draft, setDraft] = React.useState('')
  const scrollRef = React.useRef<ScrollView>(null)

  // Load history, then refetch on every inserted message (Realtime), which also
  // covers our own sends. Re-runs if the game changes; cleans up the channel.
  React.useEffect(() => {
    let active = true
    const load = () => {
      fetchMessages(gameId).then((msgs) => {
        if (active) setMessages(msgs)
      })
    }
    load()
    const unsubscribe = subscribeToGameMessages(gameId, load)
    return () => {
      active = false
      unsubscribe()
    }
  }, [gameId])

  const canSend = draft.trim() !== '' && !!user

  function send() {
    if (!canSend || !user) return
    void sendMessage(gameId, user.id, draft)
    setDraft('')
  }

  return (
    <View>
      <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 0.8, marginBottom: 10 }}>CHAT</Text>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 0.5,
          borderColor: colors.borderStrong,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: 280 }}
          contentContainerStyle={{ padding: 14, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.textMuted} />
              <Text style={{ fontSize: 13, color: colors.textMuted }}>No messages yet — say hi 👋</Text>
            </View>
          ) : (
            messages.map((message) => <MessageRow key={message.id} message={message} />)
          )}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the group…"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={send}
            returnKeyType="send"
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.textPrimary,
              backgroundColor: colors.surface2,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 0.5,
              borderColor: colors.borderStrong,
            }}
          />
          <TouchableOpacity
            onPress={send}
            disabled={!canSend}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? colors.accent : colors.surface2,
              borderWidth: 0.5,
              borderColor: canSend ? colors.accent : colors.borderStrong,
            }}
          >
            <Ionicons name="arrow-up" size={18} color={canSend ? colors.accentDark : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
