'use client'

import { BarcodeChart } from '@/components/Void/BarcodeChart'
import { VoidGrid } from '@/components/Void/VoidGrid'
import { VoidMetricCell } from '@/components/Void/VoidMetricCell'
import { VoidSection } from '@/components/Void/VoidSection'
import { useMetrics } from '@/hooks/queries/metrics'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { getFormattedMetricValue } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { startOfMonth, subDays, subMonths } from 'date-fns'
import { useContext, useMemo, useState } from 'react'

const RANGES = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
] as const

type RangeKey = (typeof RANGES)[number]['key']

type MetricKey = keyof schemas['MetricsTotals']

interface MetricSpec {
  key: MetricKey
  mode: 'last' | 'total'
}

const GROUPS: { title: string; metrics: MetricSpec[] }[] = [
  {
    title: 'Revenue',
    metrics: [
      { key: 'revenue', mode: 'total' },
      { key: 'net_revenue', mode: 'total' },
      { key: 'average_order_value', mode: 'total' },
      { key: 'gross_margin', mode: 'total' },
    ],
  },
  {
    title: 'Subscriptions',
    metrics: [
      { key: 'monthly_recurring_revenue', mode: 'last' },
      { key: 'active_subscriptions', mode: 'last' },
      { key: 'new_subscriptions', mode: 'total' },
      { key: 'churned_subscriptions', mode: 'total' },
    ],
  },
  {
    title: 'Commerce',
    metrics: [
      { key: 'orders', mode: 'total' },
      { key: 'checkouts', mode: 'total' },
      { key: 'checkouts_conversion', mode: 'total' },
      { key: 'one_time_products', mode: 'total' },
    ],
  },
  {
    title: 'Unit economics',
    metrics: [
      { key: 'average_revenue_per_user', mode: 'total' },
      { key: 'ltv', mode: 'total' },
      { key: 'costs', mode: 'total' },
      { key: 'cost_per_user', mode: 'total' },
    ],
  },
]

const ALL_KEYS = GROUPS.flatMap((group) =>
  group.metrics.map((metric) => metric.key),
)

export default function ClientPage() {
  const { organization } = useContext(OrganizationContext)
  const [range, setRange] = useState<RangeKey>('30d')

  const { startDate, endDate, interval } = useMemo(() => {
    const end = new Date()
    if (range === '12m') {
      return {
        startDate: startOfMonth(subMonths(end, 11)),
        endDate: end,
        interval: 'month' as const,
      }
    }
    return {
      startDate: subDays(end, range === '90d' ? 89 : 29),
      endDate: end,
      interval: 'day' as const,
    }
  }, [range])

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organization_id: organization.id,
    metrics: ALL_KEYS,
  })

  const seriesFor = (key: MetricKey) =>
    data?.periods.map((period) => period[key] ?? 0) ?? []

  const valueFor = ({ key, mode }: MetricSpec) => {
    const metric = data?.metrics[key]
    if (!metric) return '0'
    const series = seriesFor(key)
    const last = [...series].reverse().find((point) => point !== 0) ?? 0
    const value = mode === 'last' ? last : (data?.totals[key] ?? 0)
    return getFormattedMetricValue(metric, value)
  }

  const revenueSeries = seriesFor('revenue')
  const revenueTotal = data?.totals.revenue ?? 0
  const rangeLabel = RANGES.find((option) => option.key === range)?.label ?? ''

  return (
    <Box as="main" flexDirection="column" paddingTop="xl" flexGrow={1}>
      <VoidSection flush label="Metrics" meta={rangeLabel}>
        <Box columnGap="xl" flexWrap="wrap" rowGap="s">
          {RANGES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className="cursor-pointer border-0 bg-transparent p-0"
            >
              <Text
                variant="heading-xxs"
                color={range === option.key ? 'default' : 'muted'}
              >
                {range === option.key ? `— ${option.label}` : option.label}
              </Text>
            </button>
          ))}
        </Box>
        <Box flexDirection="column" rowGap="2xl">
          <Text variant="heading-xxs">Revenue</Text>
          <Text variant="heading-2xl">
            {formatCurrency('standard')(revenueTotal, 'usd')}
          </Text>
          {revenueSeries.length > 0 ? (
            <BarcodeChart values={revenueSeries} height={140} />
          ) : null}
        </Box>
        {GROUPS.map((group) => (
          <Box key={group.title} flexDirection="column" rowGap="2xl">
            <Text variant="heading-xs">{group.title}</Text>
            <VoidGrid>
              {group.metrics.map((metric) => (
                <VoidMetricCell
                  key={metric.key}
                  label={data?.metrics[metric.key]?.display_name ?? metric.key}
                  value={valueFor(metric)}
                  series={seriesFor(metric.key)}
                />
              ))}
            </VoidGrid>
          </Box>
        ))}
      </VoidSection>
    </Box>
  )
}
