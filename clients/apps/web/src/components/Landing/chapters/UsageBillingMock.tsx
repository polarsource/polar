'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, type ReactNode } from 'react'
import { EventLog } from './EventLog'
import { MarginChart } from './MarginChart'
import { UsageBillingCharge } from './UsageBillingCharge'
import { useTweenedValues } from './useTweened'
import { compact, dollars, percent, useUsageStream } from './useUsageStream'

const Stat = ({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) => (
  <Box flexDirection="column" rowGap="xs">
    <Text variant="caption" color="muted">
      {label}
    </Text>
    <Text variant="heading-xs" as="p" tabularNums>
      {value}
      {sub ? (
        <Text as="span" variant="heading-xs" color="muted">
          {' '}
          {sub}
        </Text>
      ) : null}
    </Text>
  </Box>
)

/** A total set right, its label led by the swatch of the line it draws in the chart. */
const Total = ({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) => (
  <Box flexDirection="column" rowGap="xs" alignItems="end">
    <Box alignItems="center" columnGap="s">
      {children}
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Box>
    <Text variant="heading-xs" as="p" tabularNums>
      {value}
    </Text>
  </Box>
)

/** The chrome of the site's modals: a dark frame with a hairline and a 4px inset. The header sits on the frame. */
const Panel = ({ children }: { children: ReactNode }) => (
  <div className="dark:bg-polar-950 flex h-full w-full flex-col rounded-2xl bg-gray-100 p-1">
    {children}
  </div>
)

/** The lighter panel inside the frame, holding the content. */
const Inner = ({ children }: { children: ReactNode }) => (
  <div className="dark:bg-polar-900 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl bg-white">
    {children}
  </div>
)

/** One Polar window: the events streaming in on the left, and the unit economics they add up to on the right. */
export const UsageBillingMock = () => {
  const { ref, events, totals, series, margin } = useUsageStream()
  const [tokens, revenue, cost, marginShown] = useTweenedValues(
    useMemo(
      () => [totals.tokens, totals.revenue, totals.cost, margin],
      [totals, margin],
    ),
  )

  return (
    <div
      ref={ref}
      className="dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-[url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)] bg-cover bg-center p-4 md:p-12"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/20" />
      <Box position="relative" width="100%">
        <Panel>
          <Box
            alignItems="center"
            justifyContent="between"
            paddingHorizontal="xl"
            paddingVertical="m"
          >
            <LogoType height={14} />
            <Text variant="caption" color="muted">
              Current cycle
            </Text>
          </Box>
          <Grid templateColumns={{ base: '1fr', md: '2fr 3fr' }} gap="xs">
            <Inner>
              <Box flexDirection="column" height="100%">
                <Box
                  alignItems="center"
                  justifyContent="between"
                  columnGap="l"
                  marginHorizontal="xl"
                  paddingVertical="l"
                  borderBottomWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                >
                  <Box flexDirection="column">
                    <Text variant="body">Acme Inc</Text>
                    <Text variant="caption" color="muted">
                      joe@acme.com
                    </Text>
                  </Box>
                </Box>
                <Box flexDirection="column" rowGap="l" padding="xl">
                  <Box justifyContent="between" alignItems="baseline">
                    <Text variant="caption" color="muted">
                      Usage
                    </Text>
                    <Text variant="caption" color="muted" tabularNums>
                      {compact(tokens)} tokens
                    </Text>
                  </Box>
                  <EventLog events={events} />
                </Box>
                <Box marginTop="auto" flexDirection="column" width="100%">
                  <UsageBillingCharge usageCharge={totals.revenue} />
                </Box>
              </Box>
            </Inner>
            <Inner>
              <Box flexDirection="column" rowGap="l" padding="xl" height="100%">
                <Box justifyContent="between" alignItems="start" columnGap="l">
                  <Stat
                    label="Gross margin"
                    value={totals.revenue > 0 ? percent(marginShown) : '—'}
                  />
                  <Box columnGap="2xl">
                    <Total label="Revenue" value={dollars(revenue, 2)}>
                      <div className="h-0.5 w-3 rounded-full bg-black dark:bg-white" />
                    </Total>
                    <Total label="Inference cost" value={dollars(cost, 2)}>
                      <div className="dark:border-polar-500 w-3 border-t border-dashed border-gray-400" />
                    </Total>
                  </Box>
                </Box>
                <MarginChart series={series} legend={false} />
              </Box>
            </Inner>
          </Grid>
        </Panel>
      </Box>
    </div>
  )
}
