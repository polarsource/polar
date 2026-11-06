'use client'

import { useModal } from '@/components/Modal/useModal'
import { useEventTypes } from '@/hooks/queries/event_types'
import { CostDistributionStrip } from '@/components/Events/CostDistributionStrip'
import {
  useEventHierarchyStats,
  useEvents,
  useEventVarianceStats,
} from '@/hooks/queries/events'
import { buildEventsFilter } from '@/utils/event'
import { formatCostAmount } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import {
  Button,
  InlineModal,
  SegmentedControl,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { TextCursorInput } from '@polar-sh/orbit/icons'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { CostEventItem, CostEventList } from './CostEventList'
import {
  CostFact,
  CostMiniChart,
  CostPanelSection,
  CostPanelShell,
  CostFactsSkeleton,
  CostListSkeleton,
  eventCostCents,
} from './CostDetailParts'
import {
  CostRange,
  parseCost,
  pickCostInterval,
  toStatsDates,
} from './costRanges'
import { EditEventTypeModal } from './EditEventTypeModal'

const eventsPath = (
  organizationSlug: string,
  eventName: string,
  range: CostRange,
) =>
  `/dashboard/${organizationSlug}/analytics/events?${new URLSearchParams({
    eventTypes: eventName,
    costOnly: 'true',
    startDate: range.from.toISOString(),
    endDate: range.to.toISOString(),
  })}`

export const CostTypeDetails = ({
  organization,
  eventTypeId,
  range,
  customerIds,
  onClose,
}: {
  organization: schemas['Organization']
  eventTypeId: string
  range: CostRange
  customerIds: string[] | null
  onClose: () => void
}) => {
  const customer_id = customerIds && customerIds.length > 0 ? customerIds : null
  const { data } = useEventHierarchyStats(organization.id, {
    ...toStatsDates(range),
    interval: pickCostInterval(range),
    event_type_id: eventTypeId,
    aggregate_fields: ['_cost.amount'],
    customer_id,
  })
  const stat = data?.totals[0]
  const { data: outliers } = useEventVarianceStats(
    organization.id,
    {
      ...toStatsDates(range),
      aggregate_fields: ['_cost.amount'],
      name: stat ? [stat.name] : null,
      customer_id,
      limit: 5,
    },
    !!stat,
  )
  const { data: samples } = useEvents(
    organization.id,
    {
      name: stat ? [stat.name] : null,
      customer_id,
      filter: buildEventsFilter({ costOnly: true, llmOnly: false }),
      start_timestamp: range.from.toISOString(),
      end_timestamp: range.to.toISOString(),
      limit: 100,
      sorting: ['-timestamp'],
    },
    !!stat,
  )
  const costedEvents = (samples?.items ?? []).flatMap((event) => {
    const cost = eventCostCents(event.metadata)
    return cost !== null ? [{ event, cost }] : []
  })
  const sampleCosts = costedEvents.map(({ cost }) => cost)
  const average = stat ? parseCost(stat.averages) : 0
  const outlierItems: CostEventItem[] = (outliers?.items ?? []).map((item) => {
    const cost = parseCost(item.values)
    return {
      id: item.event_id,
      timestamp: item.timestamp,
      detail: average > 0 ? `${(cost / average).toFixed(1)}× average` : null,
      cost,
    }
  })
  const recentItems: CostEventItem[] = costedEvents
    .slice(0, 8)
    .map(({ event, cost }) => ({
      id: event.id,
      timestamp: event.timestamp,
      detail: event.customer?.name ?? event.customer?.email ?? null,
      cost,
    }))
  const [list, setList] = useState<'recent' | 'outliers'>('recent')
  const listItems = list === 'outliers' ? outlierItems : recentItems
  const editModal = useModal()
  // There's no lookup by id, so search by the stat's name and match the id.
  const { data: eventTypes } = useEventTypes(
    organization.id,
    { query: stat?.name, limit: 100 },
    !!stat,
  )
  const eventType = eventTypes?.items.find((item) => item.id === eventTypeId)

  return (
    <CostPanelShell
      title={stat?.label ?? (data ? 'Event type' : null)}
      subtitle={stat && stat.label !== stat.name ? stat.name : null}
      href={stat ? eventsPath(organization.slug, stat.name, range) : undefined}
      hrefLabel="Open in Events"
      actions={
        eventType && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Edit label"
                onClick={editModal.show}
              >
                <TextCursorInput className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit label</TooltipContent>
          </Tooltip>
        )
      }
      onClose={onClose}
    >
      {!data ? (
        <CostFactsSkeleton rows={6} />
      ) : (
        <CostPanelSection>
          <CostMiniChart
            values={(data?.periods ?? []).map((period) =>
              period.stats.reduce((sum, s) => sum + parseCost(s.totals), 0),
            )}
          />
          <Box flexDirection="column" paddingTop="s">
            <CostFact
              label="Total"
              value={stat ? formatCostAmount(parseCost(stat.totals)) : null}
            />
            <CostFact
              label="Events"
              value={stat?.occurrences.toLocaleString('en-US')}
            />
            <CostFact
              label="Customers"
              value={stat?.customers.toLocaleString('en-US')}
            />
            <CostFact
              label="Average"
              value={stat ? formatCostAmount(parseCost(stat.averages)) : null}
            />
            <CostFact
              label="p90"
              value={stat ? formatCostAmount(parseCost(stat.p90)) : null}
            />
            <CostFact
              label="p99"
              value={stat ? formatCostAmount(parseCost(stat.p99)) : null}
            />
          </Box>
        </CostPanelSection>
      )}
      {(!data || (stat && !samples)) && <CostListSkeleton />}
      {sampleCosts.length >= 2 && (
        <CostPanelSection
          title="Distribution"
          caption={`Last ${sampleCosts.length} events`}
        >
          <Box flexDirection="column" paddingTop="s">
            <CostDistributionStrip costs={sampleCosts} />
          </Box>
        </CostPanelSection>
      )}
      {(recentItems.length > 0 || outlierItems.length > 0) && (
        <CostPanelSection
          title="Events"
          action={
            outlierItems.length > 0 ? (
              <SegmentedControl<'recent' | 'outliers'>
                size="sm"
                value={list}
                onChange={setList}
                options={[
                  { value: 'recent', label: 'Recent' },
                  { value: 'outliers', label: 'Outliers' },
                ]}
              />
            ) : undefined
          }
        >
          <CostEventList
            organizationSlug={organization.slug}
            items={listItems}
          />
        </CostPanelSection>
      )}
      {eventType && (
        <InlineModal
          isShown={editModal.isShown}
          hide={editModal.hide}
          modalContent={
            <EditEventTypeModal
              eventTypeId={eventTypeId}
              eventName={eventType.name}
              currentLabel={eventType.label}
              currentLabelPropertySelector={
                eventType.label_property_selector ?? null
              }
              hide={editModal.hide}
            />
          }
        />
      )}
    </CostPanelShell>
  )
}
