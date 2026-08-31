'use client'

import { useMetrics } from '@/hooks/queries/metrics'
import { getPreviousDateRange } from '@/utils/metrics'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import { useMemo } from 'react'
import { BarcodeChart } from './BarcodeChart'
import { VoidCell, VoidGrid } from './VoidGrid'
import { VoidSection } from './VoidSection'

const rangeLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })

export const VoidHero = ({ organizationId }: { organizationId: string }) => {
  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    return { startDate: subDays(end, 29), endDate: end }
  }, [])

  const { data: current } = useMetrics({
    startDate,
    endDate,
    interval: 'day',
    organization_id: organizationId,
    metrics: ['revenue', 'orders'],
  })

  const [previousStartDate, previousEndDate] = useMemo(
    () => getPreviousDateRange(startDate, endDate),
    [startDate, endDate],
  )

  const { data: previous } = useMetrics({
    startDate: previousStartDate,
    endDate: previousEndDate,
    interval: 'day',
    organization_id: organizationId,
    metrics: ['revenue'],
  })

  const revenue = current?.totals.revenue ?? 0
  const orders = current?.totals.orders ?? 0
  const previousRevenue = previous?.totals.revenue ?? 0
  const delta =
    previousRevenue > 0
      ? ((revenue - previousRevenue) / previousRevenue) * 100
      : null

  const dailyRevenue = useMemo(
    () => current?.periods.map((period) => period.revenue ?? 0) ?? [],
    [current],
  )

  return (
    <VoidSection
      flush
      anchor="usage"
      label="Usage revenue"
      meta={`${rangeLabel(startDate)} / ${rangeLabel(endDate)}`}
    >
      <Box flexDirection="column" rowGap="4xl">
        <VoidGrid>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 3 }} minHeight={220}>
            <Box flexDirection="column" justifyContent="end" flexGrow={1}>
              <Text variant="heading-2xl">
                {formatCurrency('standard')(revenue, 'usd')}
              </Text>
            </Box>
          </VoidCell>
          <VoidCell colSpan={{ base: 1, md: 2, lg: 1 }}>
            <Box
              flexDirection="column"
              justifyContent="between"
              flexGrow={1}
              rowGap="2xl"
            >
              <Box flexDirection="column" rowGap="s">
                <Text variant="heading-xxs">vs previous 30 days</Text>
                <Text variant="heading-m">
                  {delta !== null
                    ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
                    : 'new'}
                </Text>
              </Box>
              <Box flexDirection="column" rowGap="s">
                <Text variant="heading-xxs">Orders</Text>
                <Text variant="heading-m">
                  {orders.toLocaleString('en-US')}
                </Text>
              </Box>
            </Box>
          </VoidCell>
        </VoidGrid>
        {dailyRevenue.length > 0 ? (
          <BarcodeChart values={dailyRevenue} height={140} />
        ) : null}
      </Box>
    </VoidSection>
  )
}
