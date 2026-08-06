import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import MapView, { Marker, type LatLng, type Region } from 'react-native-maps'
import { resolveVenuePick } from '../src/lib/venuePicker'
import { reverseGeocode, searchVenues, type VenueResult } from '../src/lib/venueSearch'
import { colors } from '../src/theme'

const SYDNEY_REGION: Region = {
  latitude: -33.8885,
  longitude: 151.195,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
}

// Zoom in close when jumping to a searched venue — you're picking an exact spot.
const VENUE_DELTA = 0.006

const SEARCH_DEBOUNCE_MS = 450

export default function PickVenueScreen() {
  const mapRef = React.useRef<MapView>(null)
  const [pin, setPin] = React.useState<LatLng>({
    latitude: SYDNEY_REGION.latitude,
    longitude: SYDNEY_REGION.longitude,
  })
  // The venue label for the current pin — from a search hit or reverse geocode.
  const [label, setLabel] = React.useState<{ name: string; area: string } | null>(null)

  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<VenueResult[]>([])
  const [searching, setSearching] = React.useState(false)
  // Set right after picking a result so the debounce effect doesn't immediately
  // re-search for the name we just wrote into the field.
  const suppressSearch = React.useRef(false)

  // Debounced search. Each run aborts the previous request so a fast typist
  // doesn't get out-of-order results (and stays within Nominatim's rate limit).
  React.useEffect(() => {
    if (suppressSearch.current) {
      suppressSearch.current = false
      return
    }
    if (query.trim().length < 3) {
      setResults([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(async () => {
      const found = await searchVenues(query, controller.signal)
      if (controller.signal.aborted) return
      setResults(found)
      setSearching(false)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function selectResult(result: VenueResult) {
    suppressSearch.current = true
    setQuery(result.name)
    setResults([])
    setSearching(false)
    Keyboard.dismiss()
    setPin({ latitude: result.lat, longitude: result.lng })
    setLabel({ name: result.name, area: result.area })
    mapRef.current?.animateToRegion(
      { latitude: result.lat, longitude: result.lng, latitudeDelta: VENUE_DELTA, longitudeDelta: VENUE_DELTA },
      450,
    )
  }

  // Dropping the pin by hand: look up what's there so the host still gets a
  // venue name and area without typing them.
  const reverseRef = React.useRef<AbortController | null>(null)
  function movePin(coordinate: LatLng) {
    setPin(coordinate)
    setLabel(null)
    reverseRef.current?.abort()
    const controller = new AbortController()
    reverseRef.current = controller
    void reverseGeocode(coordinate.latitude, coordinate.longitude, controller.signal).then((found) => {
      if (controller.signal.aborted || !found) return
      setLabel({ name: found.name, area: found.area })
    })
  }

  React.useEffect(() => () => reverseRef.current?.abort(), [])

  function confirm() {
    resolveVenuePick({
      lat: pin.latitude,
      lng: pin.longitude,
      name: label?.name,
      area: label?.area,
    })
    router.back()
  }

  const showResults = results.length > 0 || searching

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={SYDNEY_REGION}
        onPress={(e) => movePin(e.nativeEvent.coordinate)}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
      >
        <Marker
          coordinate={pin}
          draggable
          onDragEnd={(e) => movePin(e.nativeEvent.coordinate)}
          tracksViewChanges={Platform.OS === 'android'}
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                backgroundColor: colors.accent,
                borderRadius: 20,
                padding: 8,
                borderWidth: 1.5,
                borderColor: colors.accentDark,
              }}
            >
              <Ionicons name="location" size={18} color={colors.accentDark} />
            </View>
            <View style={{ width: 2, height: 8, backgroundColor: colors.accent, marginTop: -1 }} />
          </View>
        </Marker>
      </MapView>

      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 56,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: 'rgba(14,14,14,0.92)',
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>Pick venue</Text>
          <View style={{ width: 48 }} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.surface2,
            borderRadius: 12,
            paddingHorizontal: 12,
            borderWidth: 0.5,
            borderColor: colors.borderStrong,
          }}
        >
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a venue, park or court"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 11 }}
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : query !== '' ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {showResults && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 260, marginTop: 8 }}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {results.length === 0 && !searching ? null : results.length === 0 ? (
              <Text style={{ fontSize: 13, color: colors.textMuted, paddingVertical: 10, paddingHorizontal: 4 }}>
                Searching…
              </Text>
            ) : (
              results.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  onPress={() => selectResult(result)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Ionicons name="location-outline" size={15} color={colors.accent} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                      {result.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                      {result.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16, gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(14,14,14,0.85)',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 0.5,
            borderColor: colors.borderStrong,
          }}
        >
          <Ionicons name="pin-outline" size={16} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            {label ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                  {label.name}
                </Text>
                {label.area !== '' && (
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{label.area}</Text>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Search above, or tap/drag the pin — {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={confirm}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.accent,
            borderRadius: 12,
            paddingVertical: 14,
          }}
        >
          <Ionicons name="checkmark" size={18} color={colors.accentDark} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.accentDark }}>Use this location</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
