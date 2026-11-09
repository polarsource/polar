import { eventCustomerLabel } from '@/components/Events/EventLogRow'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { buildEventDashboardPath } from '@/utils/event'
import { formatCostAmount } from '@/utils/formatters'
import { operations } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, ChevronDown, ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode, useState } from 'react'
import { eventCostCents, FeatureEventSteps } from './FeatureEventSteps'

type ListParameters = NonNullable<
  operations['events:list']['parameters']['query']
>

// `aggregate_fields` is accepted by the list endpoint but left out of the
// public schema, so it isn't in the generated parameter types.
type FeatureEventParameters = Omit<
  ListParameters,
  'organization_id' | 'page'
> & {
  aggregate_fields?: string[]
}

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const Row = ({
  toggle,
  time,
  customer,
  steps,
  cost,
  open,
  header = false,
}: Record<'time' | 'customer' | 'steps' | 'cost', ReactNode> & {
  toggle?: ReactNode
  open?: ReactNode
  header?: boolean
}) => (
  <Box
    gap="m"
    alignItems="center"
    paddingHorizontal="s"
    paddingVertical="s"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor={header ? 'border-primary' : 'border-secondary'}
  >
    <Box width={16} flexShrink={0}>
      {toggle}
    </Box>
    <Box width={120} flexShrink={0}>
      {time}
    </Box>
    <Box flexGrow={1} flexBasis={0} minWidth={80}>
      {customer}
    </Box>
    <Box width={64} flexShrink={0} justifyContent="end">
      {steps}
    </Box>
    <Box width={88} flexShrink={0} justifyContent="end">
      {cost}
    </Box>
    <Box width={16} flexShrink={0} justifyContent="end">
      {open}
    </Box>
  </Box>
)

// Each use of the feature, newest first, with the cost of its whole tree.
export const FeatureEvents = ({
  organizationId,
  organizationSlug,
  name,
  period,
  customerIds,
}: {
  organizationId: string
  organizationSlug: string
  name: string
  period: { start_date: string; end_date: string }
  customerIds: string[] | null
}) => {
  const parameters: FeatureEventParameters = {
    name: [name],
    depth: 0,
    customer_id: customerIds,
    start_timestamp: new Date(period.start_date).toISOString(),
    end_timestamp: new Date(`${period.end_date}T23:59:59.999Z`).toISOString(),
    aggregate_fields: ['_cost.amount'],
    limit: 25,
    sorting: ['-timestamp'],
  }
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading } =
    useInfiniteEvents(
      organizationId,
      parameters as Omit<ListParameters, 'organization_id' | 'page'>,
    )
  const events = data?.pages.flatMap((page) => page.items) ?? []
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <Box flexDirection="column">
      <Row
        header
        time={<Text color="muted">Time</Text>}
        customer={<Text color="muted">Customer</Text>}
        steps={<Text color="muted">Steps</Text>}
        cost={<Text color="muted">Cost</Text>}
      />
      {!isLoading && events.length === 0 && (
        <Box paddingVertical="l" paddingHorizontal="s">
          <Text color="muted">No uses in this period</Text>
        </Box>
      )}
      {events.map((event) => {
        const cost = eventCostCents(event)
        const expanded = expandedIds.has(event.id)
        const Chevron = expanded ? ChevronDown : ChevronRight
        return (
          <Box key={event.id} flexDirection="column">
            <div
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              onClick={() => toggle(event.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggle(event.id)
                }
              }}
              className="dark:hover:bg-polar-800/50 cursor-pointer hover:bg-gray-50"
            >
              <Row
                toggle={
                  event.child_count > 0 ? (
                    <Chevron className="dark:text-polar-500 h-3.5 w-3.5 text-gray-400" />
                  ) : null
                }
                time={
                  <Text color="muted" tabularNums>
                    {formatTime(event.timestamp)}
                  </Text>
                }
                customer={
                  <Text truncate>{eventCustomerLabel(event) ?? ''}</Text>
                }
                steps={
                  <Text color="muted" tabularNums>
                    {event.child_count.toLocaleString('en-US')}
                  </Text>
                }
                cost={
                  <Text tabularNums>
                    {cost !== null ? formatCostAmount(cost) : ''}
                  </Text>
                }
                open={
                  <Link
                    href={buildEventDashboardPath(organizationSlug, event.id)}
                    aria-label="Open in Events"
                    title="Open in Events"
                    onClick={(e) => e.stopPropagation()}
                    className="dark:text-polar-500 text-gray-400 hover:opacity-70"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
            </div>
            {expanded && (
              <FeatureEventSteps
                organizationId={organizationId}
                event={event}
                total={cost}
              />
            )}
          </Box>
        )
      })}
      {hasNextPage && (
        <Box paddingTop="m">
          <Button
            variant="secondary"
            size="sm"
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Load more
          </Button>
        </Box>
      )}
    </Box>
  )
}
