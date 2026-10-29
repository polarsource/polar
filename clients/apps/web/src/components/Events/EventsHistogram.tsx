import { useEventTimeseriesChunks } from '@/hooks/queries/events'
import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { addDays, differenceInDays, min, startOfDay } from 'date-fns'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const TARGET_BARS = 150
const HEIGHT = 49
const HOURLY_MAX_DAYS = 35
// The API caps hourly ranges at 7 days and daily ranges at 366 days.
const CHUNK_DAYS = { hour: 7, day: 366 }

interface Bar {
  start: Date
  end: Date
  count: number
}

const chunkRange = (startDate: Date, endDate: Date, size: number) => {
  const chunks: { start_date: string; end_date: string }[] = []
  const last = startOfDay(endDate)
  let cursor = startOfDay(startDate)
  while (cursor <= last) {
    const chunkEnd = min([addDays(cursor, size - 1), last])
    chunks.push({
      start_date: toISODate(cursor),
      end_date: toISODate(chunkEnd),
    })
    cursor = addDays(chunkEnd, 1)
  }
  return chunks
}

const rebin = (periods: Bar[]): Bar[] => {
  const size = Math.max(1, Math.ceil(periods.length / TARGET_BARS))
  const bars: Bar[] = []
  for (let i = 0; i < periods.length; i += size) {
    const group = periods.slice(i, i + size)
    bars.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      count: group.reduce((sum, period) => sum + period.count, 0),
    })
  }
  return bars
}

const formatBarStart = (date: Date, hourly: boolean) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(hourly ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  })

export const EventsHistogram = ({
  organizationId,
  startDate,
  endDate,
  eventNames,
  customerIds,
  source,
  filter,
  onSelectRange,
}: {
  organizationId: string
  startDate: Date
  endDate: Date
  eventNames: string[] | null
  customerIds: string[] | null
  source: schemas['EventSource'] | null
  filter: string | null
  onSelectRange: (range: { from: Date; to: Date }) => void
}) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const hourly = differenceInDays(endDate, startDate) <= HOURLY_MAX_DAYS
  const interval = hourly ? 'hour' : 'day'

  const results = useEventTimeseriesChunks(
    organizationId,
    chunkRange(startDate, endDate, CHUNK_DAYS[interval]),
    {
      interval,
      name: eventNames && eventNames.length > 0 ? eventNames : undefined,
      customer_id: customerIds ?? undefined,
      source: source ?? undefined,
      filter: filter ?? undefined,
    },
  )

  const seen = new Set<number>()
  const periods = results
    .flatMap((result) => result.data?.periods ?? [])
    .map((period) => ({
      start: new Date(period.period_start),
      end: new Date(period.period_end),
      count: period.stats.reduce((sum, stat) => sum + stat.occurrences, 0),
    }))
    .filter((period) => period.end > startDate && period.start < endDate)
    .filter((period) => {
      const key = period.start.getTime()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .toSorted((a, b) => a.start.getTime() - b.start.getTime())

  const bars = rebin(periods)
  const max = Math.max(1, ...bars.map((bar) => bar.count))
  const labels = [bars[0], bars[Math.floor(bars.length / 2)], bars.at(-1)]

  return (
    <Box flexDirection="column" gap="s" height={HEIGHT} flexShrink={0}>
      <div onMouseLeave={() => setHovered(null)}>
        <Box
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <div
            className={twMerge(
              'flex h-6 w-full items-end',
              bars.length > 60 ? 'gap-0.5' : 'gap-1',
            )}
          >
            {bars.map((bar, index) =>
              bar.count === 0 ? (
                <Box
                  key={bar.start.toISOString()}
                  flexGrow={1}
                  flexBasis={0}
                  height="100%"
                  onMouseEnter={() => setHovered(null)}
                />
              ) : (
                <Tooltip key={bar.start.toISOString()} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Box
                      flexGrow={1}
                      flexBasis={0}
                      height="100%"
                      alignItems="end"
                      backgroundColor={
                        index === hovered ? 'background-secondary' : undefined
                      }
                      cursor="pointer"
                      onMouseEnter={() => setHovered(index)}
                      onClick={() =>
                        onSelectRange({ from: bar.start, to: bar.end })
                      }
                    >
                      <Box
                        width="100%"
                        height={`${(bar.count / max) * 100}%`}
                        minHeight={2}
                        backgroundColor="background-inverse"
                        opacity={index === hovered ? 0.8 : 0.35}
                      />
                    </Box>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <Text variant="caption" tabularNums>
                      {formatBarStart(bar.start, hourly)} ·{' '}
                      {bar.count.toLocaleString('en-US')}{' '}
                      {bar.count === 1 ? 'event' : 'events'}
                    </Text>
                  </TooltipContent>
                </Tooltip>
              ),
            )}
          </div>
        </Box>
      </div>
      <Box justifyContent="between" height={16}>
        {labels.map((bar, index) => (
          <Text key={index} variant="caption" color="muted" tabularNums>
            {bar ? formatBarStart(bar.start, hourly) : ''}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
