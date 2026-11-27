import { format } from 'date-fns'

const UNITS = [
  { label: 'day', seconds: 86_400 },
  { label: 'hour', seconds: 3_600 },
  { label: 'minute', seconds: 60 },
  { label: 'second', seconds: 1 },
]

const plural = (count: number, label: string) =>
  `${count} ${label}${count === 1 ? '' : 's'}`

// "3 days, 4 hours ago": the two largest units that apply.
export const formatRelative = (date: Date, now: number) => {
  const diff = Math.round((now - date.getTime()) / 1000)
  const elapsed = Math.abs(diff)
  const index = UNITS.findIndex((unit) => elapsed >= unit.seconds)
  if (index < 0) return 'just now'
  const major = UNITS[index]
  const majorCount = Math.floor(elapsed / major.seconds)
  const parts = [plural(majorCount, major.label)]
  const minor = UNITS[index + 1]
  if (minor) {
    const minorCount = Math.floor(
      (elapsed - majorCount * major.seconds) / minor.seconds,
    )
    if (minorCount > 0) parts.push(plural(minorCount, minor.label))
  }
  const text = parts.join(', ')
  return diff >= 0 ? `${text} ago` : `in ${text}`
}

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
// Further off than this, the day itself says more than a count of days.
const RELATIVE_DAYS = 30

// "3h ago": the largest unit that applies, for a narrow column.
export const formatRelativeShort = (date: Date, now: number) => {
  const diff = now - date.getTime()
  const minutes = Math.floor(Math.abs(diff) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes >= RELATIVE_DAYS * MINUTES_PER_DAY) return formatDay(date)
  const text =
    minutes < MINUTES_PER_HOUR
      ? `${minutes}m`
      : minutes < MINUTES_PER_DAY
        ? `${Math.floor(minutes / MINUTES_PER_HOUR)}h`
        : `${Math.floor(minutes / MINUTES_PER_DAY)}d`
  return diff >= 0 ? `${text} ago` : `in ${text}`
}

export const formatDay = (date: Date) => format(date, 'MMM d, yyyy')

export const formatTimeOfDay = (date: Date) => format(date, 'HH:mm')

export const formatDate = (date: Date, timeZone?: string) =>
  date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone })

export const formatTime = (date: Date, timeZone?: string) =>
  date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  })

export const offsetLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'Local'

// To the second, without the year: for a log of recent events.
export const formatEventTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
