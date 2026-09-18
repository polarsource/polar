import { StatisticCard } from '@/components/Shared/StatisticCard'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'
import { shortDate } from './identities'
import { dayLabel, formatReducerTotal, VoidReducerSeries } from './reducers'
import { TableSection } from './VoidIdentityTables'
import { VoidLoading } from './voidStatus'
import { VoidSparkline } from './VoidSparkline'

interface VoidReducerActivityProps {
  createdAt: string
  type: 'scalar' | 'dict'
  series?: VoidReducerSeries
  loading: boolean
}

export function VoidReducerActivity({
  createdAt,
  type,
  series,
  loading,
}: VoidReducerActivityProps): ReactNode {
  const activeDays = countActiveDays(series)
  const labels =
    series?.periods.map((period) => dayLabel(period.timestamp)) ?? []
  const stats = [
    ['Total / 30 days', formatReducerTotal(series?.total)],
    ['All time', formatReducerTotal(series?.allTime)],
    ['Active days / 30', series ? String(activeDays) : '—'],
    ['Created', shortDate(createdAt)],
  ] as const

  let chart: ReactNode
  if (series && series.periods.length > 0) {
    chart = (
      <Box flexDirection="column" rowGap="l">
        <VoidSparkline
          values={series.periods.map((period) => period.value)}
          labels={labels}
          height={100}
        />
        <Box justifyContent="between">
          <Text variant="caption" color="muted">
            {labels[0]}
          </Text>
          <Text variant="caption" color="muted">
            {labels[labels.length - 1]}
          </Text>
        </Box>
      </Box>
    )
  } else if (type === 'scalar') {
    chart = <Text color="muted">No values in the last 30 days</Text>
  } else {
    chart = <Text color="muted">Dict reducers are not charted</Text>
  }

  return (
    <TableSection title="Activity" caption="Last 30 days, daily · UTC">
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
