import { eventCustomerLabel } from '@/components/Events/EventLogRow'
import { resolveTimelineEventHref } from '@/components/Timeline/links'
import { resolveTimelineEntry } from '@/components/Timeline/renderers'
import { formatRelativeTime } from '@/components/Timeline/TimelineItem'
import { useEvents, useEventTypeStats } from '@/hooks/queries/events'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { addDays, startOfDay } from 'date-fns'
import { useContext, useEffect, useState } from 'react'
import { ListRow } from './ListRow'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetGuard } from './WidgetGuard'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Activity'
const VISIBLE_ROWS = 5
// Low-importance events are skipped, so fetch enough to fill the rows.
const FETCHED_EVENTS = 40

interface ActivityWidgetProps {
  className?: string
}

export const ActivityWidget = ({ className }: ActivityWidgetProps) => (
  <WidgetGuard
    permission="analytics:read"
    title={WIDGET_TITLE}
    className={className}
  >
    <ActivityWidgetContent className={className} />
  </WidgetGuard>
)

const ActivityWidgetContent = ({ className }: ActivityWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const [today, setToday] = useState(() => startOfDay(new Date()))
  // Roll the count over at local midnight while the dashboard stays open.
  useEffect(() => {
    const timeout = setTimeout(
      () => setToday(startOfDay(new Date())),
      addDays(today, 1).getTime() - Date.now(),
    )
    return () => clearTimeout(timeout)
  }, [today])

  const {
    data: recent,
    isLoading,
    isError,
    refetch,
  } = useEvents(organization.id, {
    limit: FETCHED_EVENTS,
    sorting: ['-timestamp'],
    depth: 0,
    source: 'system',
  })
  const { data: todaysTypes } = useEventTypeStats(organization.id, {
    source: 'system',
    start_timestamp: today.toISOString(),
  })
  const todaysCount = todaysTypes?.reduce(
    (sum, type) => sum + type.occurrences,
    0,
  )

  const rows = (recent?.items ?? [])
    .map((event) => ({ event, entry: resolveTimelineEntry(event) }))
    .filter(({ entry }) => entry?.importance === 'high')
    .slice(0, VISIBLE_ROWS)

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {todaysCount?.toLocaleString() ?? '–'}
          </Text>
          <Text color="muted">events today</Text>
        </Box>
      }
      action={
        <WidgetLink
          href={`/dashboard/${organization.slug}/analytics/events?source=system&range=today`}
        />
      }
      className={className}
    >
      {isError ? (
        <WidgetError title="Couldn't load activity" onRetry={() => refetch()} />
      ) : !isLoading && rows.length === 0 ? (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>No activity yet</Text>
          <Text color="muted">
            Orders, subscriptions and customers will show up here.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {rows.map(({ event, entry }) => (
            <ListRow
              key={event.id}
              href={resolveTimelineEventHref(event, organization.slug)}
            >
              <Box alignItems="baseline" columnGap="s" minWidth={0}>
                <Text truncate>{entry?.title}</Text>
                <Text color="muted" truncate>
                  {eventCustomerLabel(event) ?? entry?.summary}
                </Text>
              </Box>
              <Text color="muted" tabularNums>
                {formatRelativeTime(event.timestamp)}
              </Text>
            </ListRow>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}
