import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Copy,
  X,
} from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode } from 'react'
import { EventSourceBadge } from './EventSourceBadge'
import {
  eventCost,
  eventCustomerLabel,
  formatEventTimestamp,
} from './EventLogRow'
import { useEventCard } from './utils'

const IconButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) => (
  <Button
    size="icon"
    variant="ghost"
    className="h-7 w-7"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
)

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box justifyContent="between" alignItems="center" gap="l" minHeight={28}>
    <Box flexShrink={0}>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Box>
    <Box minWidth={0} justifyContent="end">
      {children}
    </Box>
  </Box>
)

const Section = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    gap="s"
    paddingHorizontal="l"
    paddingVertical="m"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    <Text variant="caption">{title}</Text>
    {children}
  </Box>
)

const formatMetadataValue = (value: unknown) =>
  typeof value === 'object' ? JSON.stringify(value) : String(value)

const EventDetails = ({
  event,
  organization,
  onSelectEvent,
}: {
  event: schemas['Event']
  organization: schemas['Organization']
  onSelectEvent: (id: string) => void
}) => {
  const eventCard = useEventCard(event)
  const customer = eventCustomerLabel(event)
  const cost = eventCost(event)
  const { data: childrenData } = useInfiniteEvents(organization.id, {
    parent_id: event.id,
    depth: 1,
    limit: 50,
    sorting: ['timestamp'],
  })
  const children = childrenData?.pages.flatMap((page) => page.items) ?? []
  const metadata = Object.entries(event.metadata).filter(
    ([key]) => key !== '_cost',
  )

  return (
    <>
      <Box flexDirection="column" paddingHorizontal="l" paddingVertical="m">
        <Field label="Time">
          <Text variant="caption" tabularNums>
            {formatEventTimestamp(event.timestamp)}
          </Text>
        </Field>
        <Field label="Source">
          <EventSourceBadge source={event.source} />
        </Field>
        <Field label="Name">
          <Text variant="caption" truncate>
            {event.name}
          </Text>
        </Field>
        <Field label="ID">
          <Box alignItems="center" gap="xs" minWidth={0}>
            <Text variant="caption" truncate monospace>
              {event.id}
            </Text>
            <IconButton
              label="Copy ID"
              onClick={() => navigator.clipboard.writeText(event.id)}
            >
              <Copy className="h-3.5 w-3.5" />
            </IconButton>
          </Box>
        </Field>
        {customer && (
          <Field label="Customer">
            {event.customer ? (
              <Link
                href={buildCustomerDashboardPath(
                  organization.slug,
                  event.customer,
                )}
                className="min-w-0 truncate text-xs hover:underline"
              >
                {customer}
              </Link>
            ) : (
              <Text variant="caption" truncate>
                {customer}
              </Text>
            )}
          </Field>
        )}
        {event.parent_id && (
          <Field label="Parent">
            <button
              type="button"
              className="cursor-pointer text-xs hover:underline"
              onClick={() => onSelectEvent(event.parent_id as string)}
            >
              View parent
            </button>
          </Field>
        )}
        {cost && (
          <Field label="Cost">
            <Text variant="caption" tabularNums>
              {cost}
            </Text>
          </Field>
        )}
      </Box>

      {event.source === 'system' && eventCard && (
        <Section title="Details">
          <div className="-mx-3">{eventCard}</div>
        </Section>
      )}

      {metadata.length > 0 && (
        <Section title="Metadata">
          {metadata.map(([key, value]) => (
            <Field key={key} label={key}>
              <Text variant="caption" truncate monospace>
                {formatMetadataValue(value)}
              </Text>
            </Field>
          ))}
        </Section>
      )}

      {children.length > 0 && (
        <Section title="Children">
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              className="cursor-pointer text-left"
              onClick={() => onSelectEvent(child.id)}
            >
              <Box
                justifyContent="between"
                gap="l"
                minHeight={28}
                alignItems="center"
              >
                <Text variant="caption" truncate>
                  {child.label}
                </Text>
                <Text variant="caption" color="muted" tabularNums>
                  {eventCost(child) ?? ''}
                </Text>
              </Box>
            </button>
          ))}
        </Section>
      )}
    </>
  )
}

export const EventDetailPanel = ({
  eventId,
  organization,
  onSelectEvent,
  onPrevious,
  onNext,
  onClose,
}: {
  eventId: string
  organization: schemas['Organization']
  onSelectEvent: (id: string) => void
  onPrevious?: () => void
  onNext?: () => void
  onClose: () => void
}) => {
  const { data: event } = useEvent(organization.id, eventId)

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 hidden w-[400px] shrink-0 flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xs lg:flex">
      <Box
        alignItems="center"
        justifyContent="between"
        gap="s"
        paddingLeft="l"
        paddingRight="m"
        paddingVertical="m"
      >
        <Box minWidth={0}>
          <Text variant="body" truncate>
            {event?.label ?? ''}
          </Text>
        </Box>
        <Box alignItems="center" flexShrink={0}>
          <IconButton
            label="Previous event"
            onClick={onPrevious}
            disabled={!onPrevious}
          >
            <ChevronUp className="h-4 w-4" />
          </IconButton>
          <IconButton label="Next event" onClick={onNext} disabled={!onNext}>
            <ChevronDown className="h-4 w-4" />
          </IconButton>
          <Link
            href={`/dashboard/${organization.slug}/analytics/events/${eventId}`}
          >
            <IconButton label="Open event">
              <ArrowUpRight className="h-4 w-4" />
            </IconButton>
          </Link>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </Box>
      </Box>
      {event && (
        <EventDetails
          event={event}
          organization={organization}
          onSelectEvent={onSelectEvent}
        />
      )}
    </div>
  )
}
