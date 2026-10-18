// Date/time helpers. The server speaks UTC everywhere; everything here
// converts to the viewer's local time for display only.

const LOCALE = 'he-IL'

export const toDate = (value) => (value instanceof Date ? value : new Date(value))

export function formatTime(value) {
  return toDate(value).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(value) {
  return toDate(value).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatShortDay(value) {
  return toDate(value).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'numeric' })
}

// Wrapped in a left-to-right isolate (U+2066 ... U+2069): inside Hebrew text
// the bidi algorithm would otherwise flip "10:00–11:00" into "11:00–10:00".
// Word joiners (U+2060) around the dash stop it from wrapping mid-range.
export function formatRange(start, end) {
  return `⁦${formatTime(start)}⁠–⁠${formatTime(end)}⁩`
}

export function minutesBetween(start, end) {
  return Math.round((toDate(end) - toDate(start)) / 60000)
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} דק׳`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hoursText = hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`
  return rest ? `${hoursText} ו-${rest} דק׳` : hoursText
}

// "בעוד 3 ימים", "לפני שעתיים"... via the built-in Intl API, no library needed.
const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

export function formatRelative(value, now = new Date()) {
  const diffMs = toDate(value) - now
  const minutes = Math.round(diffMs / 60000)
  if (Math.abs(minutes) < 1) return 'עכשיו'
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 14) return relativeFormatter.format(days, 'day')
  return relativeFormatter.format(Math.round(days / 7), 'week')
}

export function isSameDay(a, b) {
  const x = toDate(a)
  const y = toDate(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

export function addDays(value, days) {
  const d = new Date(toDate(value))
  d.setDate(d.getDate() + days)
  return d
}

// Israeli week: starts on Sunday.
export function startOfWeek(value) {
  const d = new Date(toDate(value))
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

// Same half-open rule as the server: 10:00-11:00 and 11:00-12:00 don't overlap.
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return toDate(aStart) < toDate(bEnd) && toDate(bStart) < toDate(aEnd)
}

// yyyy-mm-dd in *local* time, for <input type="date">.
export function toDateInputValue(value) {
  const d = toDate(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toTimeInputValue(value) {
  const d = toDate(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

export function firstName(fullName = '') {
  return fullName.trim().split(/\s+/)[0] ?? ''
}
