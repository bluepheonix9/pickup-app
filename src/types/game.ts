export type GameStatus = 'live' | 'upcoming' | 'open'

// A game's difficulty. 'open' means "open to all levels".
export type Difficulty = 'open' | 'beginner' | 'intermediate' | 'advanced'

export type Venue = {
  name: string
  area: string
  lat: number
  lng: number
}

export type Organizer = {
  name: string
  avatarEmoji: string
}

export type Game = {
  id: string
  title: string
  sport: string
  difficulty: Difficulty
  tags: string[]
  venue: Venue
  startsAt: string
  // Optional end of the game, set by the host. Undefined when they didn't say.
  endsAt?: string
  startTime: string
  price: string
  status: GameStatus
  imageUrl?: string
  imageFallback: string
  spots: number
  spotsLeft: number
  featured?: boolean
  // The host's profile, embedded from Supabase for display (organizer name/avatar).
  organizer?: Organizer
  // Auth user id of the host. Optional only because in-progress form drafts may
  // not have it yet; every persisted game row has one.
  hostId?: string
}

export type TimeWindow = 'today' | 'upcoming' | 'past'

export type PriceFilter = 'free' | 'paid'

export type GameFilters = {
  area?: string
  sport?: string
  difficulty?: Difficulty
  status?: GameStatus
  featured?: boolean
  ids?: string[]
  when?: TimeWindow
  tag?: string
  price?: PriceFilter
}
