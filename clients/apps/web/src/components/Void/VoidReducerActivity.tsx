import MetricChartBox from '@/components/Metrics/MetricChartBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { shortDate } from './identities'
import { meterSeriesToChart } from './meters'
import { formatReducerTotal, VoidReducerSeries } from './reducers'
import { TableSection } from './VoidIdentityTables'
import { VoidLoading } from './voidStatus'

interface VoidReducerActivityProps {
  name: string
  createdAt: string
  type: 'scalar' | 'dict'
  series?: VoidReducerSeries
  loading: boolean
}

export function VoidReducerActivity({
  name,
  createdAt,
  type,
  series,
  loading,
}: VoidReducerActivityProps): ReactNode {
  const activeDays = countActiveDays(series)
  const stats = [
    ['Total / 30 days', formatReducerTotal(series?.total)],
    ['All time', formatReducerTotal(series?.allTime)],
    ['Active days / 30', series ? String(activeDays) : '—'],
    ['Created', shortDate(createdAt)],
  ] as const

  let chart: ReactNode
  if (series && series.periods.length > 0) {
    chart = (
      <MetricChartBox
        data={meterSeriesToChart(
          {
            total: series.total ?? 0,
            allTime: series.allTime ?? 0,
            periods: series.periods,
          },
          name,
        )}
        interval="day"
        metric="orders"
        height={200}
        chartType="line"
        shareable={false}
        exportable={false}
      />
    )
  } else if (type === 'scalar') {
    chart = <Text color="muted">No values in the last 30 days</Text>
  } else {
    chart = <Text color="muted">Dict reducers are not charted</Text>
  }

  return (
    <TableSection title="Activity" caption="Daily, last 30 days">
      {loading ? (
        <VoidLoading />
      ) : (
        <Box flexDirection="column" rowGap="xl">
          <Box
            display={{ base: 'grid', xl: 'flex' }}
            gridTemplateColumns="repeat(2, 1fr)"
            gap={{ base: 'l', md: 'xl' }}
          >
            {stats.map(([title, value]) => (
              <StatisticCard
                key={title}
                title={title}
                size="lg"
                valueClassName="font-sans"
              >
                {value}
              </StatisticCard>
            ))}
          </Box>
          {chart}
        </Box>
      )}
    </TableSection>
  )
}

function countActiveDays(series?: VoidReducerSeries): number {
  if (!series) return 0
  return series.periods.filter(
    (period) => period.value !== null && period.value > 0,
  ).length
}
