'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { StaticImage } from '@/components/Image/StaticImage'
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
    <Text variant="heading-xs" tabularNums>
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

/** The chrome of the site's modals: a dark frame with a hairline and a 4px inset. The header sits on the frame. */
const Panel = ({ children }: { children: ReactNode }) => (
  <div className="dark:bg-polar-950 dark:border-polar-800 flex h-full w-full flex-col rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
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
                  <Box alignItems="center" columnGap="m">
                    <StaticImage
                      src="/assets/acme.jpg"
                      alt="Acme Inc"
                      width={32}
                      height={32}
                      className="size-8 rounded-full object-cover"
                    />
                    <Box flexDirection="column">
                      <Text variant="body">Acme Inc</Text>
                      <Text variant="caption" color="muted">
                        joe@acme.com
                      </Text>
                    </Box>
                  </Box>
                </Box>
                <Grid
                  templateColumns="repeat(2, 1fr)"
                  marginHorizontal="xl"
                  paddingVertical="l"
                  borderBottomWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                >
                  <Stat label="Tokens metered" value={compact(tokens)} />
                  <Box
                    paddingLeft="xl"
                    borderLeftWidth={1}
                    borderStyle="solid"
                    borderColor="border-primary"
                  >
                    <Stat label="Revenue" value={dollars(revenue, 2)} />
                  </Box>
                </Grid>
                <Box padding="xl">
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
                  <Box flexDirection="column" rowGap="xs" alignItems="end">
                    <Text variant="caption" color="muted">
                      Inference cost
                    </Text>
                    <Text variant="heading-xs" tabularNums>
                      {dollars(cost, 2)}
                    </Text>
                  </Box>
                </Box>
                <MarginChart series={series} />
              </Box>
            </Inner>
          </Grid>
        </Panel>
      </Box>
    </div>
  )
}
