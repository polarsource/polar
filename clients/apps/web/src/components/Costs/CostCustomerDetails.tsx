'use client'

import { useCustomer } from '@/hooks/queries/customers'
import {
  useEventHierarchyStats,
  useInfiniteEvents,
} from '@/hooks/queries/events'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { buildEventsFilter } from '@/utils/event'
import { formatCostAmount } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
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

export const CostCustomerDetails = ({
  organization,
  customerId,
  label,
  range,
  onSelectEventType,
  onClose,
}: {
  organization: schemas['Organization']
  customerId: string
  label: string | null
  range: CostRange
  onSelectEventType: (eventTypeId: string) => void
  onClose: () => void
}) => {
  const { data: customer } = useCustomer(customerId)
  const { data } = useEventHierarchyStats(organization.id, {
    ...toStatsDates(range),
    interval: pickCostInterval(range),
    aggregate_fields: ['_cost.amount'],
    customer_id: [customerId],
  })
  const types = (data?.totals ?? [])
    .map((stat) => ({ ...stat, cost: parseCost(stat.totals) }))
    .filter((stat) => stat.cost > 0)
    .sort((a, b) => b.cost - a.cost)
  const total = types.reduce((sum, stat) => sum + stat.cost, 0)
  const occurrences = types.reduce((sum, stat) => sum + stat.occurrences, 0)

  const { data: recent } = useInfiniteEvents(organization.id, {
    customer_id: [customerId],
    filter: buildEventsFilter({ costOnly: true, llmOnly: false }),
    start_timestamp: range.from.toISOString(),
    end_timestamp: range.to.toISOString(),
    limit: 10,
    sorting: ['-timestamp'],
  })
  const recentItems: CostEventItem[] = (recent?.pages[0]?.items ?? []).flatMap(
    (event) => {
      const cost = eventCostCents(event.metadata)
      return cost !== null
        ? [
            {
              id: event.id,
              timestamp: event.timestamp,
              detail: event.label,
              cost,
            },
          ]
        : []
    },
  )

  return (
    <CostPanelShell
      title={
        customer?.name ?? customer?.email ?? label ?? (data ? 'Customer' : null)
      }
      subtitle={customer?.name ? customer.email : null}
      href={buildCustomerDashboardPath(organization.slug, {
        id: customerId,
        email: customer?.email,
        name: customer?.name ?? label,
      })}
      hrefLabel="Open customer"
      onClose={onClose}
    >
      {!data ? (
        <CostFactsSkeleton rows={3} />
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
              value={data ? formatCostAmount(total) : null}
            />
            <CostFact
              label="Events"
              value={data ? occurrences.toLocaleString('en-US') : null}
            />
            <CostFact
              label="Average"
              value={
                data && occurrences > 0
                  ? formatCostAmount(total / occurrences)
                  : null
              }
            />
          </Box>
        </CostPanelSection>
      )}
      {types.length > 0 && (
        <CostPanelSection title="By event type">
          {types.slice(0, 8).map((stat) => (
            <button
              key={stat.event_type_id}
              type="button"
              onClick={() => onSelectEventType(stat.event_type_id)}
              className="dark:hover:bg-polar-800/50 -mx-4 cursor-pointer px-4 text-left hover:bg-gray-50"
            >
              <CostFact
                label={stat.label}
                value={formatCostAmount(stat.cost)}
              />
            </button>
          ))}
        </CostPanelSection>
      )}
      {!recent && <CostListSkeleton />}
      {recentItems.length > 0 && (
        <CostPanelSection title="Recent events">
          <CostEventList
            organizationSlug={organization.slug}
            items={recentItems}
          />
        </CostPanelSection>
      )}
    </CostPanelShell>
  )
}
