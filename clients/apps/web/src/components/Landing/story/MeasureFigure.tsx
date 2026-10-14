'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { EventLog } from '../chapters/EventLog'
import { FLOW, Sheet } from './Frame'
import { useTweenedValues } from '../chapters/useTweened'
import {
  compact,
  useUsageStream,
  type UsageEventName,
} from '../chapters/useUsageStream'

/** Enough rows to fill the sheet beside the three meters. */
const LOG_ROWS = 8

const METERS: { name: UsageEventName; label: string; fold: string }[] = [
  { name: 'tokens.in', label: 'Input tokens', fold: 'sum(tokens)' },
  { name: 'tokens.out', label: 'Output tokens', fold: 'sum(tokens)' },
  { name: 'tool.call', label: 'Tool calls', fold: 'count()' },
]

/**
 * Fig. 02: Acme's events on the left, the meters folding them in the middle, and an entitlement check
 * answered next to the code on the right. Same customer and stream as the hero.
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
            Acme Inc
          </Text>
        </Box>
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 1fr' }} gap="xs">
          <Sheet title="Events in">
            <EventLog events={events} rows={LOG_ROWS} fade={false} />
          </Sheet>
          <Sheet title="Meters">
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
          <Sheet
            title="Customer state"
            aside={
              <Text variant="caption" color="muted">
                API
              </Text>
            }
          >
            <Text variant="caption" monospace>
              {"polar.customers.getStateExternal('acme')"}
            </Text>
            <Box flexDirection="column" rowGap="s">
              <Box justifyContent="between" alignItems="baseline" columnGap="l">
                <Text variant="default" color="muted">
                  Subscription
                </Text>
                <Box alignItems="center" columnGap="s">
                  <div className="size-1.5 rounded-full bg-emerald-500" />
                  <Text variant="default">Pro · active</Text>
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
