'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { StaticImage } from '@/components/Image/StaticImage'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { EventLog } from '../chapters/EventLog'
import { FLOW, Sheet } from './Frame'
import { useTweenedValues } from '../chapters/useTweened'
import {
  compact,
  useUsageStream,
  type UsageEvent,
  type UsageEventName,
} from '../chapters/useUsageStream'

/** Enough rows to fill the sheet beside the three meters. */
const LOG_ROWS = 8

/** Every customer sends events into the same stream; Acme, the one followed through the page, sends the most. */
const SENDERS = [
  'Acme Inc',
  'Northwind',
  'Acme Inc',
  'Lumen',
  'Acme Inc',
  'Atlas',
]
const customerOf = (event: UsageEvent) => SENDERS[event.id % SENDERS.length]

const METERS: { name: UsageEventName; label: string; fold: string }[] = [
  { name: 'tokens.in', label: 'Input tokens', fold: "sum('tokens.in')" },
  { name: 'tokens.out', label: 'Output tokens', fold: "sum('tokens.out')" },
  { name: 'tool.call', label: 'Tool calls', fold: "count('tool.call')" },
]

/**
 * Fig. 02: every customer's events on the left, tagged by who sent them, then Acme's meters and Acme's state.
 * Same customer and stream as the hero.
 */
export const MeasureFigure = () => {
  const { ref, events, totals } = useUsageStream(LOG_ROWS)
  const readings = useTweenedValues(
    METERS.map((m) => totals.units[m.name]),
    480,
  )

  return (
    <div
      ref={ref}
      className={`dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-cover bg-center p-4 md:p-12 ${FLOW[2]}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="dark:bg-polar-950 dark:border-polar-800 relative flex w-full flex-col rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
        <Box
          alignItems="center"
          justifyContent="between"
          paddingHorizontal="xl"
          paddingVertical="m"
        >
          <LogoType height={14} />
          <Text variant="caption" color="muted">
            Events from every customer
          </Text>
        </Box>
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1fr' }} gap="xs">
          <Sheet title="Event Ingestion">
            <EventLog
              events={events}
              rows={LOG_ROWS}
              fade={false}
              customerOf={customerOf}
            />
          </Sheet>
          <Sheet
            title="Meters"
            aside={
              <Text variant="caption" color="muted">
                Acme Inc
              </Text>
            }
          >
            <Box flexDirection="column" rowGap="l">
              {METERS.map((meter, i) => (
                <Box key={meter.name} flexDirection="column" rowGap="xs">
                  <Box
                    justifyContent="between"
                    alignItems="baseline"
                    columnGap="l"
                  >
                    <Text variant="caption" color="muted">
                      {meter.label}
                    </Text>
                    <Text variant="caption" monospace color="muted">
                      {meter.fold}
                    </Text>
                  </Box>
                  <Text variant="heading-xxs" tabularNums>
                    {compact(readings[i])}
                  </Text>
                </Box>
              ))}
            </Box>
          </Sheet>
          <Sheet title="Customer state">
            <Box
              alignItems="center"
              columnGap="m"
              paddingBottom="l"
              borderBottomWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <StaticImage
                src="/assets/acme.jpg"
                alt="Acme Inc"
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-full object-cover"
              />
              <Box flexDirection="column">
                <Text variant="default">Acme Inc</Text>
                <Text variant="caption" color="muted">
                  joe@acme.com
                </Text>
              </Box>
            </Box>
            <Box flexDirection="column" rowGap="s">
              <Box justifyContent="between" alignItems="baseline" columnGap="l">
                <Text variant="default" color="muted">
                  Subscription
                </Text>
                <Box alignItems="center" columnGap="s">
                  <div className="size-1.5 rounded-full bg-emerald-500" />
                  <Text variant="default">Business</Text>
                </Box>
              </Box>
              <Box justifyContent="between" alignItems="baseline" columnGap="l">
                <Text variant="default" color="muted">
                  Credits left
                </Text>
                <Text variant="default" tabularNums>
                  3,180
                </Text>
              </Box>
              <Box justifyContent="between" alignItems="baseline" columnGap="l">
                <Text variant="default" color="muted">
                  Output tokens
                </Text>
                <Text variant="default" tabularNums>
                  {compact(readings[1])}
                </Text>
              </Box>
            </Box>
            <Box
              marginTop="auto"
              paddingTop="l"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Text variant="caption" color="muted">
                Subscriptions, benefits and meter balances in one call, and a
                webhook when any of them change.
              </Text>
            </Box>
          </Sheet>
        </Grid>
      </div>
    </div>
  )
}
