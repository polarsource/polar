import { type CondensedTableColumn } from '@/components/Shared/CondensedTable'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { EventTimestamp } from './EventTimestamp'
import { formatEventTimestamp } from './timestampFormat'

export { formatEventTimestamp }

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

export const eventLLM = (event: schemas['Event']) =>
  '_llm' in event.metadata && event.metadata._llm ? event.metadata._llm : null

export const formatTokens = (tokens: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(tokens)

export const eventLogColumns: CondensedTableColumn<schemas['Event']>[] = [
  {
    id: 'time',
    header: 'Time',
    meta: {
      width: 128,
      skeleton: [104],
    },
    cell: ({ row: { original: event } }) => (
      <EventTimestamp
        timestamp={event.timestamp}
        format="precise"
        muted
        focusable={false}
      />
    ),
  },
  {
    id: 'event',
    header: 'Event',
    meta: {
      grow: 2,
      minWidth: 120,
      skeleton: [140, 180, 120, 200, 160, 110, 190, 150, 130, 170],
    },
    cell: ({ row: { original: event } }) => (
      <>
        <Text truncate>{event.label}</Text>
        {event.child_count > 0 && (
          <Text color="muted" tabularNums>
            +{event.child_count}
          </Text>
        )}
      </>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    meta: {
      skeleton: [90, 70, 100, 80, 60],
    },
    cell: ({ row: { original: event } }) => (
      <Text color="muted" truncate>
        {eventCustomerLabel(event) ?? '—'}
      </Text>
    ),
  },
  {
    id: 'tokens',
    header: 'Tokens',
    meta: {
      width: 72,
      align: 'end',
    },
    cell: ({ row: { original: event } }) => {
      const llm = eventLLM(event)
      return (
        <Text color="muted" tabularNums>
          {llm ? formatTokens(llm.total_tokens) : ''}
        </Text>
      )
    },
  },
  {
    id: 'cost',
    header: 'Cost',
    meta: {
      width: 88,
      align: 'end',
    },
    cell: ({ row: { original: event } }) => (
      <Text color="muted" tabularNums>
        {eventCost(event) ?? ''}
      </Text>
    ),
  },
]

export const EventLogCompactRow = ({ event }: { event: schemas['Event'] }) => {
  const customer = eventCustomerLabel(event)
  const cost = eventCost(event)
  return (
    <>
      <Box alignItems="center" justifyContent="between" gap="m">
        <Box alignItems="center" gap="s" minWidth={0}>
          <Text truncate>{event.label}</Text>
          {event.child_count > 0 && (
            <Text color="muted" tabularNums>
              +{event.child_count}
            </Text>
          )}
        </Box>
        {cost && (
          <Box flexShrink={0}>
            <Text color="muted" tabularNums>
              {cost}
            </Text>
          </Box>
        )}
      </Box>
      <Box alignItems="center" gap="s" minWidth={0}>
        <Box flexShrink={0}>
          <Text variant="caption" color="muted" tabularNums>
            {formatEventTimestamp(event.timestamp)}
          </Text>
        </Box>
        {customer && (
          <Text variant="caption" color="muted" truncate>
            · {customer}
          </Text>
        )}
      </Box>
    </>
  )
}
