import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDownRight, ArrowUpRight } from '@polar-sh/orbit/icons'
import { subDays } from 'date-fns'
import { twMerge } from 'tailwind-merge'
import { CostDistributionStrip, percentile } from './CostDistributionStrip'

const SAMPLE_SIZE = 100
const WINDOW_DAYS = 30

const costOf = (event: schemas['Event']) =>
  '_cost' in event.metadata && event.metadata._cost
    ? Number(event.metadata._cost.amount ?? 0)
    : null

const Verdict = ({ cost, average }: { cost: number; average: number }) => {
  const ratio = average > 0 ? cost / average : 1
  const above = ratio >= 1
  const Arrow = above ? ArrowUpRight : ArrowDownRight

  return (
    <Box alignItems="center" gap="xs">
      <Arrow
        className={twMerge(
          'h-3.5 w-3.5',
          above ? 'text-red-500' : 'text-emerald-500',
        )}
      />
      <Text tabularNums>
        {above
          ? `${ratio.toFixed(ratio < 10 ? 1 : 0)}× average`
          : `${Math.round((1 - ratio) * 100)}% below average`}
      </Text>
    </Box>
  )
}

export const useEventCostSamples = (
  event: schemas['Event'],
  organizationId: string,
) => {
  const end = new Date(event.timestamp)
  return useEvents(
    organizationId,
    {
      name: [event.name],
      start_timestamp: subDays(end, WINDOW_DAYS).toISOString(),
      end_timestamp: end.toISOString(),
      limit: SAMPLE_SIZE,
      sorting: ['-timestamp'],
    },
    costOf(event) !== null,
  )
}

export const EventCostComparison = ({
  event,
  samples,
}: {
  event: schemas['Event']
  samples: schemas['Event'][]
}) => {
  const cost = costOf(event)
  const costs = samples
    .map(costOf)
    .filter((value): value is number => value !== null)
    .toSorted((a, b) => a - b)

  if (cost === null || costs.length < 2) {
    return null
  }

  const average = costs.reduce((sum, value) => sum + value, 0) / costs.length
  const anomalous = cost > percentile(costs, 0.99)

  return (
    <Box flexDirection="column" gap="m">
      <Box alignItems="center" justifyContent="between" gap="s">
        <Verdict cost={cost} average={average} />
        {anomalous && <Text color="danger">Above p99</Text>}
      </Box>
      <CostDistributionStrip costs={costs} highlight={cost} />
      <Text color="muted">Compared with the last {costs.length} events</Text>
    </Box>
  )
}
