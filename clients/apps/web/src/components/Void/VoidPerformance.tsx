'use client'

import { useMetrics } from '@/hooks/queries/metrics'
import { getFormattedMetricValue } from '@/utils/metrics'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import { useMemo } from 'react'
import { BarcodeChart } from './BarcodeChart'
import { VoidCell, VoidGrid } from './VoidGrid'
import { VoidSection } from './VoidSection'
import { VoidSegmentBar } from './VoidSegmentBar'

const STAT_KEYS = [
  'monthly_recurring_revenue',
  'active_subscriptions',
  'churn_rate',
  'average_revenue_per_user',
] as const

// Levels (MRR, active subscriptions) read as the latest value; aggregates
// (churn, ARPU) read as the totals the API computes over the range.
const MODE: Record<(typeof STAT_KEYS)[number], 'last' | 'total'> = {
  monthly_recurring_revenue: 'last',
  active_subscriptions: 'last',
  churn_rate: 'total',
  average_revenue_per_user: 'total',
}

const usd = formatCurrency('standard')

export const VoidPerformance = ({
  organizationId,
  label = 'Performance',
}: {
  organizationId: string
  label?: string
}) => {
  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    return { startDate: subDays(end, 29), endDate: end }
  }, [])

  const { data } = useMetrics({
    startDate,
    endDate,
    interval: 'day',
    organization_id: organizationId,
    metrics: [
      ...STAT_KEYS,
      'one_time_products_revenue',
      'new_subscriptions_revenue',
      'renewed_subscriptions_revenue',
      'gross_margin',
      'costs',
      'checkouts',
      'succeeded_checkouts',
    ],
  })

  const total = (key: keyof NonNullable<typeof data>['totals']) =>
    data?.totals[key] ?? 0

  const stats = STAT_KEYS.map((key) => {
    const metric = data?.metrics[key]
    const series = data?.periods.map((period) => period[key] ?? 0) ?? []
    const lastValue = [...series].reverse().find((value) => value !== 0) ?? 0
    const value = MODE[key] === 'last' ? lastValue : total(key)
    return {
      key,
      label: metric?.display_name ?? key,
      value: metric ? getFormattedMetricValue(metric, value) : '0',
      series,
    }
  })

  const oneTime = total('one_time_products_revenue')
  const newSubs = total('new_subscriptions_revenue')
  const renewals = total('renewed_subscriptions_revenue')
  const mixTotal = Math.max(oneTime + newSubs + renewals, 1)

  const margin = total('gross_margin')
  const costs = total('costs')
  const marginTotal = Math.max(margin + costs, 1)

  const succeeded = total('succeeded_checkouts')
  const abandoned = Math.max(total('checkouts') - succeeded, 0)
  const checkoutTotal = Math.max(succeeded + abandoned, 1)

  return (
    <VoidSection label={label} meta="30 days">
      <VoidGrid>
        {stats.map((stat) => (
          <VoidCell key={stat.key} minHeight={220}>
            <Box
              flexDirection="column"
              justifyContent="between"
              flexGrow={1}
              rowGap="2xl"
            >
              <Text variant="heading-xxs">{stat.label}</Text>
              <Box flexDirection="column" rowGap="l">
                <Text variant="heading-l">{stat.value}</Text>
                {stat.series.length > 0 ? (
                  <BarcodeChart values={stat.series} height={32} barWidth={2} />
                ) : null}
              </Box>
            </Box>
          </VoidCell>
        ))}
        <VoidCell span={12}>
          <Box flexDirection="column" rowGap="2xl">
            <Text variant="heading-xxs">Revenue mix</Text>
            <VoidSegmentBar
              height={40}
              segments={[
                {
                  label: 'Renewals',
                  share: renewals / mixTotal,
                  tone: 'ink',
                  detail: usd(renewals, 'usd'),
                },
                {
                  label: 'New subscriptions',
                  share: newSubs / mixTotal,
                  tone: 'mid',
                  detail: usd(newSubs, 'usd'),
                },
                {
                  label: 'One-time',
                  share: oneTime / mixTotal,
                  tone: 'faint',
                  detail: usd(oneTime, 'usd'),
                },
              ]}
            />
          </Box>
        </VoidCell>
        <VoidCell span={{ base: 12, lg: 6 }}>
          <Box flexDirection="column" rowGap="2xl" flexGrow={1}>
            <Text variant="heading-xxs">Gross margin</Text>
            <VoidSegmentBar
              height={40}
              segments={[
                {
                  label: 'Margin',
                  share: margin / marginTotal,
                  tone: 'ink',
                  detail: usd(margin, 'usd'),
                },
                {
                  label: 'Costs',
                  share: costs / marginTotal,
                  tone: 'faint',
                  detail: usd(costs, 'usd'),
                },
              ]}
            />
          </Box>
        </VoidCell>
        <VoidCell span={{ base: 12, lg: 6 }}>
          <Box flexDirection="column" rowGap="2xl" flexGrow={1}>
            <Text variant="heading-xxs">Checkout conversion</Text>
            <VoidSegmentBar
              height={40}
              segments={[
                {
                  label: 'Converted',
                  share: succeeded / checkoutTotal,
                  tone: 'ink',
                  detail: `${succeeded.toLocaleString('en-US')}`,
                },
                {
                  label: 'Abandoned',
                  share: abandoned / checkoutTotal,
                  tone: 'faint',
                  detail: `${abandoned.toLocaleString('en-US')}`,
                },
              ]}
            />
          </Box>
        </VoidCell>
      </VoidGrid>
    </VoidSection>
  )
}
