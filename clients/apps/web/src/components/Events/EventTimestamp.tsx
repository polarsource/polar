import {
  Grid,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, useEffect, useState } from 'react'

const UNITS = [
  { label: 'day', seconds: 86_400 },
  { label: 'hour', seconds: 3_600 },
  { label: 'minute', seconds: 60 },
  { label: 'second', seconds: 1 },
]

const plural = (count: number, label: string) =>
  `${count} ${label}${count === 1 ? '' : 's'}`

const formatRelative = (date: Date, now: number) => {
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

const formatDate = (date: Date, timeZone?: string) =>
  date.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone })

const formatTime = (date: Date, timeZone?: string) =>
  date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  })

const offsetLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'Local'

const useNow = () => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  return now
}

const ZoneRow = ({
  label,
  date,
  timeZone,
}: {
  label: string
  date: Date
  timeZone?: string
}) => (
  <>
    <Text color="muted">{label}</Text>
    <Box alignItems="baseline" columnGap="s">
      <Text>{formatDate(date, timeZone)}</Text>
      <Text color="muted" tabularNums>
        {formatTime(date, timeZone)}
      </Text>
    </Box>
  </>
)

const TimestampDetails = ({ date }: { date: Date }) => {
  const now = useNow()
  const local = offsetLabel(date)
  const isUtc = date.getTimezoneOffset() === 0

  return (
    <Grid templateColumns="auto auto" columnGap="l" rowGap="xs">
      <Text color="muted">Relative</Text>
      <Text>{formatRelative(date, now)}</Text>
      <ZoneRow label="UTC" date={date} timeZone="UTC" />
      {!isUtc && <ZoneRow label={local} date={date} />}
    </Grid>
  )
}

export const EventTimestamp = ({
  timestamp,
  focusable = true,
  children,
}: {
  timestamp: string
  focusable?: boolean
  children: ReactNode
}) => (
  <Tooltip delayDuration={300}>
    <TooltipTrigger asChild>
      <span
        className="inline-flex max-w-full min-w-0"
        tabIndex={focusable ? 0 : undefined}
      >
        {children}
      </span>
    </TooltipTrigger>
    <TooltipContent side="left" align="center" className="p-3">
      <TimestampDetails date={new Date(timestamp)} />
    </TooltipContent>
  </Tooltip>
)
