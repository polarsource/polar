import { eventCustomerLabel } from '@/components/Events/EventLogRow'
import { useFeatureHighlights } from '@/hooks/queries/featureBreakdown'
import { useEvents } from '@/hooks/queries/events'
import { operations, schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { eventsHref } from './eventsHref'
import { eventCostCents } from './FeatureEventSteps'
import { formatAmount, formatUnitAmount } from './featureEconomics'
import { FeatureWidget, formatTime, WidgetRow } from './FeatureWidget'

const LIMIT = 5

type ListParameters = NonNullable<
  operations['events:list']['parameters']['query']
>

type Props = {
  organizationId: string
  organizationSlug: string
  name: string
  period: { start_date: string; end_date: string }
  currency: string
}

const LatestEvents = ({
  organizationId,
  organizationSlug,
  name,
  period,
  currency,
}: Props) => {
  // `aggregate_fields` sums the cost of each use's whole tree; it is accepted
  // by the endpoint but left out of the generated parameter types.
  const parameters = {
    name: [name],
    depth: 0,
    start_timestamp: new Date(period.start_date).toISOString(),
    end_timestamp: new Date(`${period.end_date}T23:59:59.999Z`).toISOString(),
    aggregate_fields: ['_cost.amount'],
    limit: LIMIT,
    sorting: ['-timestamp'],
  } as Omit<ListParameters, 'organization_id'>
  const { data } = useEvents(organizationId, parameters)
  const events = data?.items ?? []
  return (
    <FeatureWidget
      title="Latest events"
      loading={!data}
      href={eventsHref(organizationSlug, period, { eventTypes: [name] })}
      empty={data && events.length === 0 ? 'No events' : undefined}
    >
      {events.map((event) => {
        const cost = eventCostCents(event)
        return (
          <WidgetRow
            key={event.id}
            href={eventsHref(organizationSlug, period, {
              eventTypes: [name],
              event: event.id,
            })}
            time={formatTime(event.timestamp)}
            primary={eventCustomerLabel(event) ?? 'No customer'}
            value={
              <Text tabularNums>
                {cost !== null ? formatUnitAmount(cost, currency) : ''}
              </Text>
            }
          />
        )
      })}
    </FeatureWidget>
  )
}

const CostAnomalies = ({
  organizationSlug,
  name,
  period,
  currency,
  anomalies,
}: Props & {
  anomalies: schemas['FeatureAnomaly'][] | undefined
}) => (
  <FeatureWidget
    title="Cost anomalies"
    loading={anomalies === undefined}
    href={eventsHref(organizationSlug, period, {
      eventTypes: [name],
    })}
    empty={anomalies && anomalies.length === 0 ? 'No outliers' : undefined}
  >
    {anomalies?.map((anomaly) => (
      <WidgetRow
        key={anomaly.id}
        href={eventsHref(organizationSlug, period, {
          eventTypes: [name],
          event: anomaly.id,
        })}
        time={formatTime(anomaly.timestamp)}
        primary={
          anomaly.customer_name ?? anomaly.external_customer_id ?? 'No customer'
        }
        value={
          <Box alignItems="baseline" gap="s">
            <Text color="muted" tabularNums>
              {Number(anomaly.multiple)}×
            </Text>
            <Text tabularNums>
              {formatAmount(Number(anomaly.cost), currency)}
            </Text>
          </Box>
        }
      />
    ))}
  </FeatureWidget>
)

export const FeatureWidgets = (props: Props) => {
  const { data } = useFeatureHighlights(
    props.organizationId,
    props.name,
    props.period,
  )
  return (
    <Box
      display="grid"
      gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 200px), 1fr))"
      columnGap="2xl"
      rowGap="2xl"
      alignItems="start"
    >
      <LatestEvents {...props} />
      <CostAnomalies {...props} anomalies={data?.anomalies} />
    </Box>
  )
}
