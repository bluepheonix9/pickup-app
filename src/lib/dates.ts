// Date helpers shared across the app — formatting game times for display and
// converting between Date objects and the values the web date inputs expect.

// "6:00 PM"
export function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// "Sat 8 Aug"
export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

// "Sat 8 Aug · 6:00 PM"
export function formatDateTimeLabel(d: Date): string {
  return `${formatDateLabel(d)} · ${formatTimeLabel(d)}`
}

// The one-line time shown on cards: "Starts 6:00 PM", or the full range when
// the host gave an end time.
export function formatStartTime(startsAt: Date, endsAt?: Date | null): string {
  if (!endsAt) return `Starts ${formatTimeLabel(startsAt)}`
  return `${formatTimeLabel(startsAt)} – ${formatTimeLabel(endsAt)}`
}

// ---- Web <input> value conversion ----
// Both input types are local-time strings with no timezone, so build them from
// local getters rather than toISOString (which would shift by the UTC offset).

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Date → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
export function toDateTimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Date → "HH:mm" for <input type="time">.
export function toTimeValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "YYYY-MM-DDTHH:mm" → Date. Null when the input is blank or unparseable.
export function fromDateTimeLocalValue(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// "HH:mm" applied to the calendar day of `base`. Null when the value is blank.
export function fromTimeValue(value: string, base: Date): Date | null {
  const m = value.match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  const d = new Date(base)
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// The end field only picks a clock time, so whatever calendar day its Date
// happens to carry is meaningless — it goes stale as soon as the start date
// changes. Take just the hours/minutes and anchor them to the start's day,
// rolling forward when the game runs past midnight.
export function normalizeEnd(start: Date, end: Date): Date {
  const combined = new Date(start)
  combined.setHours(end.getHours(), end.getMinutes(), 0, 0)
  if (combined <= start) combined.setDate(combined.getDate() + 1)
  return combined
}

// The next round half-hour from now — a sensible default for a new game.
export function nextHalfHour(): Date {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30)
  return d
}
