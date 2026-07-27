import * as Location from 'expo-location'
import React from 'react'

export type Coords = { lat: number; lng: number }

// Ask for foreground location permission once and return the device's coords.
// Returns null while loading, or if permission is denied / location is
// unavailable (e.g. web without a granted prompt) — callers fall back to a
// default origin, so the UI always has something sensible.
export function useUserLocation(): Coords | null {
  const [coords, setCoords] = React.useState<Coords | null>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const position = await Location.getCurrentPositionAsync({})
        if (!cancelled) {
          setCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
        }
      } catch {
        // Denied or unavailable — leave coords null so the caller uses the default.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return coords
}
