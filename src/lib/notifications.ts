import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerPushToken(userId: string) {
  // Push notifications require a physical device and native build
  if (Platform.OS === 'web') return
  if (!Device.isDevice) return

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) {
    // EAS project not linked yet — run `eas init` and add the projectId to app.json
    console.warn('[notifications] No EAS projectId found — push registration skipped')
    return
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== 'granted') {
    const { status: asked } = await Notifications.requestPermissionsAsync()
    status = asked
  }
  if (status !== 'granted') return

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId)
}
