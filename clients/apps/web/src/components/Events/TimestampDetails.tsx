import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'
import {
  formatDate,
  formatRelative,
  formatTime,
  offsetLabel,
} from './timestampFormat'

// The current time, kept up to date at the given pace.
export const useNow = (interval = 1000) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(timer)
  }, [interval])
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

// A moment told three ways: how long ago, in UTC, and in local time.
export const TimestampDetails = ({ date }: { date: Date }) => {
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
