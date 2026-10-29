import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDownRight, ArrowUpRight } from '@polar-sh/orbit/icons'
import { subDays } from 'date-fns'
import { twMerge } from 'tailwind-merge'

const SAMPLE_SIZE = 100
const WINDOW_DAYS = 30

const costOf = (event: schemas['Event']) =>
  '_cost' in event.metadata && event.metadata._cost
    ? Number(event.metadata._cost.amount ?? 0)
    : null

const percentile = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]

// Costs span orders of magnitude, so place them on a log scale.
const logScale = (values: number[]) => {
  const positive = values.filter((value) => value > 0)
  if (positive.length === 0) return () => 50
  const low = Math.log10(Math.min(...positive))
  const high = Math.log10(Math.max(...positive))
  return (value: number) => {
    if (value <= 0) return 0
    if (high === low) return 50
    return ((Math.log10(value) - low) / (high - low)) * 100
  }
}

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

const Marker = ({ position, label }: { position: number; label: string }) => (
  <div
    className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
    style={{ left: `${position}%` }}
  >
    <div className="dark:bg-polar-500 h-3 w-px bg-gray-400" />
    <span className="dark:text-polar-500 mt-1 text-xs leading-none text-gray-400">
      {label}
    </span>
  </div>
)

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
  const p99 = percentile(costs, 0.99)
  const anomalous = cost > p99
  const position = logScale([...costs, cost])

  return (
    <Box flexDirection="column" gap="m">
      <Box alignItems="center" justifyContent="between" gap="s">
        <Verdict cost={cost} average={average} />
        {anomalous && <Text color="danger">Above p99</Text>}
      </Box>
      <div className="relative h-7">
        <div className="dark:bg-polar-700 absolute inset-x-0 top-1.5 h-px bg-gray-200" />
        {costs.map((value, index) => (
          <div
            key={index}
            className="dark:bg-polar-600 absolute top-0.5 h-2 w-px bg-gray-300"
            style={{ left: `${position(value)}%` }}
          />
        ))}
        <Marker position={position(average)} label="avg" />
        <Marker position={position(p99)} label="p99" />
        <div
          className="absolute -top-0.5 h-4 w-px -translate-x-1/2 bg-gray-900 dark:bg-white"
          style={{ left: `${position(cost)}%` }}
        />
      </div>
    </Box>
  )
}
