'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'
import { EventLog } from '../chapters/EventLog'
import { Sheet } from './Frame'
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

/** Checks the app makes before letting Acme act, each answered from local state. */
const CHECKS = [
  { feature: 'tool.call', detail: '3,180 credits left' },
  { feature: 'gpt-5', detail: 'Included in Pro' },
  { feature: 'tokens.out', detail: 'Under the monthly cap' },
]

/** Rotates through the checks, with a sub-millisecond latency for each: no network round trip. */
const useChecks = () => {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % CHECKS.length),
      1800,
    )
    return () => clearInterval(timer)
  }, [])
  return { check: CHECKS[index], latency: [0.31, 0.42, 0.27][index], index }
}

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
  const { check, latency, index } = useChecks()

  return (
    <div
      ref={ref}
      className="dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-[url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)] bg-cover bg-center p-4 md:p-12"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="dark:bg-polar-950 dark:border-polar-800 relative flex w-full flex-col rounded-3xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
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
            title="Entitlement check"
            aside={
              <Text variant="caption" color="muted">
                Local
              </Text>
            }
          >
            <Box flexDirection="column" rowGap="l" flex={1}>
              <div
                key={index}
                className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
              >
                <Box flexDirection="column" rowGap="m">
                  <Text variant="caption" monospace>
                    {`polar.check('acme', '${check.feature}')`}
                  </Text>
                  <Box
                    alignItems="baseline"
                    justifyContent="between"
                    columnGap="l"
                  >
                    <Box alignItems="center" columnGap="s">
                      <div className="size-1.5 rounded-full bg-emerald-500" />
                      <Text variant="body">Allowed</Text>
                    </Box>
                    <Text variant="caption" color="muted" tabularNums>
                      {latency.toFixed(2)} ms
                    </Text>
                  </Box>
                  <Text variant="caption" color="muted">
                    {check.detail}
                  </Text>
                </Box>
              </div>
              <Box
                marginTop="auto"
                paddingTop="l"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              >
                <Text variant="caption" color="muted">
                  Answered from state synced next to your code. No network round
                  trip.
                </Text>
              </Box>
            </Box>
          </Sheet>
        </Grid>
      </div>
    </div>
  )
}
