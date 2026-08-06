// Bridges the host-game form and the /pick-venue map screen. host-game
// registers a callback and pushes the picker; the picker resolves it with the
// chosen venue on confirm. host-game stays mounted across the push, so its
// in-progress form state survives the round trip.

export type VenuePick = {
  lat: number
  lng: number
  // Name and area come from the venue search (or reverse geocode). Empty when
  // the pin was dropped by hand and the lookup found nothing — the host can
  // still type them in.
  name?: string
  area?: string
}

let pending: ((pick: VenuePick) => void) | null = null

export function requestVenuePick(onPick: (pick: VenuePick) => void) {
  pending = onPick
}

export function resolveVenuePick(pick: VenuePick) {
  const cb = pending
  pending = null
  cb?.(pick)
}
