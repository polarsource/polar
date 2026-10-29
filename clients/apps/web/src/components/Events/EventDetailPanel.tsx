import { useEvent, useInfiniteEvents } from '@/hooks/queries/events'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronDown, ChevronRight, ChevronUp, X } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode } from 'react'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { CopyButton } from './CopyButton'
import { Field } from './EventDetailField'
import { useEventDetailFields } from './EventDetailFields'
import { EventCostComparison, useEventCostSamples } from './EventCostComparison'
import { EventDetailSkeleton, SkeletonBar } from './EventDetailSkeleton'
import {
  eventCost,
  eventCustomerLabel,
  formatEventTimestamp,
} from './EventLogRow'

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

const Section = ({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
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
    <Box alignItems="center" justifyContent="between" minHeight={24}>
      <Text>{title}</Text>
      {action}
    </Box>
    {children}
  </Box>
)

const RelatedEventRow = ({
  event,
  showTime = false,
  onSelect,
}: {
  event: schemas['Event']
  showTime?: boolean
  onSelect: () => void
}) => (
  <button
    type="button"
    className="group dark:hover:bg-polar-800/50 -mx-4 cursor-pointer px-4 text-left hover:bg-gray-50"
    onClick={onSelect}
  >
    <Box justifyContent="between" gap="s" minHeight={32} alignItems="center">
      <Box alignItems="center" gap="s" minWidth={0}>
        <Text truncate>{event.label}</Text>
        {showTime && (
          <Text color="muted" tabularNums>
            {formatEventTimestamp(event.timestamp)}
          </Text>
        )}
      </Box>
      <Box alignItems="center" gap="xs" flexShrink={0}>
        <Text color="muted" tabularNums>
          {eventCost(event) ?? ''}
        </Text>
        <ChevronRight className="dark:text-polar-500 h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100" />
      </Box>
    </Box>
  </button>
)

const EventDetails = ({
  event,
  organization,
  onSelectEvent,
}: {
  event: schemas['Event']
  organization: schemas['Organization']
  onSelectEvent: (id: string) => void
}) => {
  const { fields: detailFields, isLoading: isLoadingDetails } =
    useEventDetailFields(event, organization.slug)
  const customer = eventCustomerLabel(event)
  const cost = eventCost(event)
  const { data: childrenData, isLoading: isLoadingChildren } =
    useInfiniteEvents(organization.id, {
      parent_id: event.id,
      depth: 1,
      limit: 50,
      sorting: ['timestamp'],
    })
  const children = childrenData?.pages.flatMap((page) => page.items) ?? []
  const { data: parent, isLoading: isLoadingParent } = useEvent(
    organization.id,
    event.parent_id ?? '',
  )
  const { data: costSamples, isLoading: isLoadingCostSamples } =
    useEventCostSamples(event, organization.id)
  const hasMetadata = Object.keys(event.metadata).length > 0

  if (
    isLoadingChildren ||
    isLoadingParent ||
    isLoadingCostSamples ||
    isLoadingDetails
  ) {
    return <EventDetailSkeleton />
  }

  return (
    <>
      <Box flexDirection="column" paddingHorizontal="l" paddingVertical="m">
        <Field label="ID" copyValue={event.id}>
          <Text truncate monospace>
            {event.id}
          </Text>
        </Field>
        <Field label="Time">
          <Text tabularNums>{formatEventTimestamp(event.timestamp)}</Text>
        </Field>
        <Field label="Source">
          <Text>{event.source === 'system' ? 'System' : 'User'}</Text>
        </Field>
        <Field label="Name">
          <Text truncate>{event.name}</Text>
        </Field>
        {customer && (
          <Field label="Customer">
            {event.customer ? (
              <Link
                href={buildCustomerDashboardPath(
                  organization.slug,
                  event.customer,
                )}
                className="min-w-0 truncate text-sm hover:opacity-60"
              >
                {customer}
              </Link>
            ) : (
              <Text truncate>{customer}</Text>
            )}
          </Field>
        )}
        {event.external_customer_id && (
          <Field label="External ID" copyValue={event.external_customer_id}>
            <Text truncate monospace>
              {event.external_customer_id}
            </Text>
          </Field>
        )}
      </Box>

      {detailFields.length > 0 && (
        <Section title="Details">
          <Box flexDirection="column">
            {detailFields.map((field) => (
              <Field key={field.label} label={field.label}>
                {field.value}
              </Field>
            ))}
          </Box>
        </Section>
      )}

      {cost && (
        <Section title="Cost" action={<Text>{cost}</Text>}>
          <EventCostComparison
            event={event}
            samples={costSamples?.items ?? []}
          />
        </Section>
      )}

      {parent && (
        <Section title="Parent">
          <RelatedEventRow
            event={parent}
            showTime
            onSelect={() => onSelectEvent(parent.id)}
          />
        </Section>
      )}

      {hasMetadata && (
        <Section
          title="Metadata"
          action={
            <CopyButton
              value={JSON.stringify(event.metadata, null, 2)}
              label="Copy metadata"
            />
          }
        >
          <div className="dark:bg-polar-800 overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-xs leading-5 [&_pre]:bg-transparent!">
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="javascript"
                code={JSON.stringify(event.metadata, null, 2)}
              />
            </SyntaxHighlighterProvider>
          </div>
        </Section>
      )}

      {children.length > 0 && (
        <Section title="Children">
          {children.map((child) => (
            <RelatedEventRow
              key={child.id}
              event={child}
              onSelect={() => onSelectEvent(child.id)}
            />
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
  const { data: event, isError } = useEvent(organization.id, eventId)

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-xs">
      <Box
        alignItems="center"
        justifyContent="between"
        gap="s"
        paddingLeft="l"
        paddingRight="m"
        paddingVertical="m"
      >
        <Box minWidth={0}>
          {event ? (
            <Text variant="body" truncate>
              {event.label}
            </Text>
          ) : (
            !isError && <SkeletonBar width={160} height={16} />
          )}
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
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </Box>
      </Box>
      {isError && (
        <Box paddingHorizontal="l" paddingVertical="m">
          <Text color="muted">Event not found</Text>
        </Box>
      )}
      {!event && !isError && <EventDetailSkeleton />}
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
