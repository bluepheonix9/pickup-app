// Venue lookup backed by OpenStreetMap Nominatim — no API key, no billing.
// Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// max ~1 request/second and a User-Agent identifying the app. Callers debounce;
// the header is set below (browsers drop it, which Nominatim tolerates).

const ENDPOINT = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'pickup-app/1.0 (sports pickup game finder)'

// The app is Sydney-scoped, so results are restricted to Australia to keep
// "Bondi" from matching a Bondi in another country. Widen when the app does.
const COUNTRY_CODES = 'au'

export type VenueResult = {
  id: string
  // Short name for the place ("Bondi Beach Basketball Courts").
  name: string
  // Suburb-ish locality used to prefill the game's area ("Bondi Beach").
  area: string
  // Full comma-separated address, shown as the result subtitle.
  address: string
  lat: number
  lng: number
}

type NominatimAddress = {
  road?: string
  suburb?: string
  neighbourhood?: string
  city_district?: string
  town?: string
  village?: string
  municipality?: string
  // A council/region grouping ("Northern Beaches") — coarser than a suburb but
  // far more useful as an area than falling all the way back to "Sydney".
  borough?: string
  city?: string
  state?: string
}

type NominatimPlace = {
  place_id: number
  display_name: string
  name?: string
  lat: string
  lon: string
  address?: NominatimAddress
}

// Nominatim spreads the locality across several optional keys depending on how
// the place is tagged — take the most specific one present.
function pickArea(address: NominatimAddress | undefined): string {
  if (!address) return ''
  return (
    address.suburb ??
    address.neighbourhood ??
    address.city_district ??
    address.town ??
    address.village ??
    address.municipality ??
    address.borough ??
    address.city ??
    ''
  )
}

function toResult(place: NominatimPlace): VenueResult {
  const parts = place.display_name.split(',').map((p) => p.trim())
  // Named places (parks, courts, beaches) carry `name`. Plain street addresses
  // don't, and their display_name starts with the house number — fall back to
  // the road so the label reads "Campbell Parade", not "146-148".
  const name = place.name?.trim() || place.address?.road || parts[0] || 'Unnamed place'
  return {
    id: String(place.place_id),
    name,
    area: pickArea(place.address),
    // Drop the leading name so the subtitle isn't "X, X, ...".
    address: parts.slice(1).join(', ') || place.display_name,
    lat: parseFloat(place.lat),
    lng: parseFloat(place.lon),
  }
}

// Free-text venue search. Returns [] for blank queries, errors, and aborts, so
// callers can render the result list without special-casing failure.
export async function searchVenues(query: string, signal?: AbortSignal): Promise<VenueResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const url =
    `${ENDPOINT}/search?q=${encodeURIComponent(q)}` +
    `&format=jsonv2&limit=8&addressdetails=1&countrycodes=${COUNTRY_CODES}`

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal })
    if (!res.ok) return []
    const data = (await res.json()) as NominatimPlace[]
    return data.map(toResult).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
  } catch {
    // Aborted (superseded by a newer keystroke) or offline — no results.
    return []
  }
}

// Coordinates → nearest named place, used to label a pin the user dropped by
// hand. Returns null when nothing sensible is nearby or the lookup fails.
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<VenueResult | null> {
  const url = `${ENDPOINT}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal })
    if (!res.ok) return null
    const data = (await res.json()) as NominatimPlace & { error?: string }
    if (data.error || !data.display_name) return null
    return toResult(data)
  } catch {
    return null
  }
}
