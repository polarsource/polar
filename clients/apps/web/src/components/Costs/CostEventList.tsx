import { buildEventDashboardPath } from '@/utils/event'
import { formatCostAmount } from '@/utils/formatters'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

export interface CostEventItem {
  id: string
  timestamp: string
  detail: string | null
  cost: number
}

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

// One costed event per row, its cost drawn against the costliest in the list
// so the spread reads at a glance.
export const CostEventList = ({
  organizationSlug,
  items,
}: {
  organizationSlug: string
  items: CostEventItem[]
}) => {
  const max = Math.max(...items.map((item) => item.cost), 0)

  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <Link
          key={item.id}
          href={buildEventDashboardPath(organizationSlug, item.id)}
          className="dark:hover:bg-polar-800/50 -mx-4 rounded-lg px-4 hover:bg-gray-50"
        >
          <Box alignItems="center" gap="m" minHeight={32}>
            <Box width={104} flexShrink={0}>
              <Text color="muted" tabularNums truncate>
                {formatTime(item.timestamp)}
              </Text>
            </Box>
            <Box flexGrow={1} flexBasis={0} minWidth={0}>
              <Text truncate>{item.detail ?? '—'}</Text>
            </Box>
            <Box
              width={48}
              height={4}
              flexShrink={0}
              backgroundColor="background-secondary"
              overflow="hidden"
            >
              <Box
                height="100%"
                width={`${max > 0 ? Math.max((item.cost / max) * 100, 4) : 0}%`}
                backgroundColor="background-inverse"
                opacity={0.8}
              />
            </Box>
            <Box width={72} flexShrink={0} justifyContent="end">
              <Text tabularNums>{formatCostAmount(item.cost)}</Text>
            </Box>
          </Box>
        </Link>
      ))}
    </Box>
  )
}
