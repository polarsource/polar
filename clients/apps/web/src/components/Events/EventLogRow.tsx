import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { twMerge } from 'tailwind-merge'

export const formatEventTimestamp = (timestamp: string) =>
  new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

export const eventCustomerLabel = (event: schemas['Event']) =>
  event.customer?.name ??
  event.customer?.email ??
  event.external_customer_id ??
  null

export const eventCost = (event: schemas['Event']) =>
  '_cost' in event.metadata && event.metadata._cost
    ? formatCurrency('subcent')(
        Number(event.metadata._cost.amount ?? 0),
        event.metadata._cost.currency ?? 'usd',
      )
    : null

export const EventLogRow = ({
  event,
  selected,
  onSelect,
}: {
  event: schemas['Event']
  selected: boolean
  onSelect: () => void
}) => {
  const customer = eventCustomerLabel(event)
  const cost = eventCost(event)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      data-event-id={event.id}
      className={twMerge(
        'w-full cursor-pointer text-left',
        selected
          ? 'dark:bg-polar-800 bg-gray-100'
          : 'dark:hover:bg-polar-800/50 hover:bg-gray-50',
      )}
    >
      <Box
        alignItems="center"
        gap="l"
        paddingHorizontal="m"
        paddingVertical="s"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box width={128} flexShrink={0}>
          <Text color="muted" tabularNums truncate>
            {formatEventTimestamp(event.timestamp)}
          </Text>
        </Box>
        <Box
          flexGrow={2}
          flexBasis={0}
          minWidth={120}
          alignItems="center"
          gap="s"
        >
          <Text truncate>{event.label}</Text>
          {event.child_count > 0 && (
            <Text color="muted" tabularNums>
              +{event.child_count}
            </Text>
          )}
        </Box>
        <Box flexGrow={1} flexBasis={0} minWidth={0}>
          <Text color="muted" truncate>
            {customer ?? '—'}
          </Text>
        </Box>
        <Box width={88} flexShrink={0} justifyContent="end">
          <Text color="muted" tabularNums>
            {cost ?? ''}
          </Text>
        </Box>
      </Box>
    </button>
  )
}

export const EventLogHeader = () => (
  <Box
    gap="l"
    paddingHorizontal="m"
    paddingVertical="s"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Box width={128} flexShrink={0}>
      <Text color="muted">Time</Text>
    </Box>
    <Box flexGrow={2} flexBasis={0} minWidth={120}>
      <Text color="muted">Event</Text>
    </Box>
    <Box flexGrow={1} flexBasis={0} minWidth={0}>
      <Text color="muted">Customer</Text>
    </Box>
    <Box width={88} flexShrink={0} justifyContent="end">
      <Text color="muted">Cost</Text>
    </Box>
  </Box>
)
