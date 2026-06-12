import { format, formatDistanceToNow } from 'date-fns'

export const relativeTime = (iso: string): string => {
  const date = new Date(iso)
  if (Date.now() - date.getTime() < 60_000) {
    return 'just now'
  }
  return formatDistanceToNow(date, { addSuffix: true }).replace(
    / minutes?/,
    ' min',
  )
}

export const exactTime = (iso: string): string => format(new Date(iso), 'PPpp')
