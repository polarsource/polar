import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MetricCard } from './MetricCard'

const formatCurrency = (cents: number) => `$${cents.toLocaleString('en-US')}`

type Direction = 'up' | 'down'

type MetricMock = {
  label: string
  value: string
  delta?: { value: number; direction: Direction }
  trailing?: 'withdraw'
}

const metrics: MetricMock[] = [
  {
    label: 'Revenue',
    value: formatCurrency(92492),
    delta: { value: 74, direction: 'up' },
  },
  {
    label: 'Retention',
    value: '53%',
    delta: { value: 23, direction: 'down' },
  },
  {
    label: 'Gross Margin',
    value: '87%',
    delta: { value: 11, direction: 'up' },
  },
  {
    label: 'Gross Margin',
    value: '72%',
    delta: { value: 5, direction: 'up' },
  },
  {
    label: 'Churn Rate',
    value: '17%',
    delta: { value: 74, direction: 'up' },
  },
  {
    label: 'Balance',
    value: formatCurrency(92492),
    trailing: 'withdraw',
  },
]

export const MetricsGrid = () => {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: '1fr',
        sm: 'repeat(2, 1fr)',
        lg: 'repeat(3, 1fr)',
      }}
      gap="xl"
    >
      {metrics.map((metric, idx) => (
        <MetricCard
          key={`${metric.label}-${idx}`}
          label={metric.label}
          value={metric.value}
          delta={metric.delta}
          trailing={
            metric.trailing === 'withdraw' ? (
              <Button>Withdraw</Button>
            ) : undefined
          }
        />
      ))}
    </Box>
  )
}
