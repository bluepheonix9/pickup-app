export type Profile = {
  displayName: string
  // Stored without the leading @ — prepend it when displaying.
  handle: string
  bio: string
  homeArea: string
  favoriteSports: string[]
  // A single emoji used as the avatar. Empty string means "no emoji picked" —
  // render colored initials from displayName instead. (No photo picker on
  // purpose: avoids adding native deps.)
  avatarEmoji: string
}
