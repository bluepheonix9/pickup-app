import { router } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../src/theme'

// react-native-maps is native-only, so the web build gets a placeholder and
// the host form falls back to entering coordinates directly.
export default function PickVenueWebScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 15, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 }}>Venue picker unavailable on web</Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
        Open the app on iOS or Android to pick a location on the map.
      </Text>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 14, color: colors.accent }}>Go back</Text>
      </TouchableOpacity>
    </View>
  )
}
