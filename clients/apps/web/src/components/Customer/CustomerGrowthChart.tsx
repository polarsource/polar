'use client'

import MetricChart from '@/components/Metrics/MetricChart'
import { ParsedMetricPeriod, useCustomerGrowth } from '@/hooks/queries'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'

type GrowthView = 'new_customers' | 'total_customers'

const GROWTH_METRICS: Record<GrowthView, schemas['Metric']> = {
  new_customers: {
    slug: 'new_customers',
    display_name: 'New Customers',
    type: 'scalar',
  },
  total_customers: {
    slug: 'total_customers',
    display_name: 'Total Customers',
    type: 'scalar',
  },
}

interface CustomerGrowthChartProps {
  organization: schemas['Organization']
  start: Date
  end: Date
  interval: schemas['TimeInterval']
}

export const CustomerGrowthChart = ({
  organization,
  start,
  end,
  interval,
}: CustomerGrowthChartProps) => {
  const [view, setView] = useState<GrowthView>('new_customers')
  const { data: growth, isLoading } = useCustomerGrowth(organization.id, {
    start,
    end,
    interval,
  })

  const periods = useMemo(
    () =>
      (growth ?? []).map((period) => ({
        timestamp: new Date(period.timestamp),
        new_customers: period.new_customers,
        total_customers: period.total_customers,
      })) as unknown as ParsedMetricPeriod[],
    [growth],
  )

  const headlineValue = useMemo(() => {
    if (!growth || growth.length === 0) {
      return 0
    }
    return view === 'new_customers'
      ? growth.reduce((sum, period) => sum + period.new_customers, 0)
      : growth[growth.length - 1].total_customers
  }, [growth, view])

  return (
    <Box
      flexDirection="column"
      rowGap="xl"
      padding="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        flexDirection={{ base: 'column', md: 'row' }}
        justifyContent="between"
        gap="l"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text color="muted">{GROWTH_METRICS[view].display_name}</Text>
          <Text variant="heading-xs" as="p">
            {formatHumanFriendlyScalar(headlineValue)}
          </Text>
        </Box>
        <Box alignItems="start">
          <SegmentedControl<GrowthView>
            options={[
              { value: 'new_customers', label: 'New' },
              { value: 'total_customers', label: 'Total' },
            ]}
            value={view}
            onChange={setView}
          />
        </Box>
      </Box>
      {isLoading ? (
        <div className="animate-pulse">
          <Box
            height={240}
            borderRadius="m"
            backgroundColor="background-card"
          />
        </div>
      ) : (
        <MetricChart
          data={periods}
          interval={interval}
          metric={GROWTH_METRICS[view]}
          chartType={view === 'new_customers' ? 'bar' : 'line'}
          height={240}
          showYAxis
        />
      )}
    </Box>
  )
}
