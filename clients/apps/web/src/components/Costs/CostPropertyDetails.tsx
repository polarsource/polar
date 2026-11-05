'use client'

import { CostDistributionStrip } from '@/components/Events/CostDistributionStrip'
import { useEventHierarchyStats, useEvents } from '@/hooks/queries/events'
import { formatCostAmount } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import {
  CostFact,
  CostMiniChart,
  CostPanelSection,
  CostPanelShell,
  CostFactsSkeleton,
  CostListSkeleton,
  eventCostCents,
} from './CostDetailParts'
import { CostEventItem, CostEventList } from './CostEventList'
import {
  CostRange,
  parseCost,
  pickCostInterval,
  toStatsDates,
} from './costRanges'
import { CostRow } from './useCostBreakdown'

export type CostProperty = 'model' | 'vendor'

const PROPERTY_LABELS: Record<CostProperty, string> = {
  model: 'Model',
  vendor: 'Vendor',
}

const propertyFilter = (
  property: CostProperty,
  value: string,
  costOnly: boolean,
) =>
  JSON.stringify({
    conjunction: 'and',
    clauses: [
      { property: `_llm.${property}`, operator: 'eq', value },
      ...(costOnly
        ? [
            {
              conjunction: 'or',
              clauses: [
                { property: '_cost.amount', operator: 'gte', value: 0 },
                { property: '_cost.amount', operator: 'lt', value: 0 },
              ],
            },
          ]
        : []),
    ],
  })

export const CostPropertyDetails = ({
  organization,
  property,
  value,
  row,
  range,
  customerIds,
  onClose,
}: {
  organization: schemas['Organization']
  property: CostProperty
  value: string
  row: CostRow | null
  range: CostRange
  customerIds: string[] | null
  onClose: () => void
}) => {
  const customer_id = customerIds && customerIds.length > 0 ? customerIds : null
  const { data } = useEventHierarchyStats(organization.id, {
    ...toStatsDates(range),
    interval: pickCostInterval(range),
    aggregate_fields: ['_cost.amount'],
    filter: propertyFilter(property, value, false),
    customer_id,
  })
  const { data: samples } = useEvents(organization.id, {
    filter: propertyFilter(property, value, true),
    customer_id,
    start_timestamp: range.from.toISOString(),
    end_timestamp: range.to.toISOString(),
    limit: 100,
    sorting: ['-timestamp'],
  })

  // The timeseries only matches top-level events, while models are often
  // set on child events. The figures come from the by-property stats, as in
  // the table, and the chart only shows when it covers every event.
  const periods = data?.periods ?? []
  const chartOccurrences = (data?.totals ?? []).reduce(
    (sum, stat) => sum + stat.occurrences,
    0,
  )
  const chartIsComplete =
    row !== null && periods.length > 0 && chartOccurrences === row.occurrences

  const costed = (samples?.items ?? []).flatMap((event) => {
    const cost = eventCostCents(event.metadata)
    return cost !== null ? [{ event, cost }] : []
  })
  const recentItems: CostEventItem[] = costed
    .slice(0, 8)
    .map(({ event, cost }) => ({
      id: event.id,
      timestamp: event.timestamp,
      detail: event.customer?.name ?? event.customer?.email ?? null,
      cost,
    }))

  return (
    <CostPanelShell
      title={value}
      subtitle={PROPERTY_LABELS[property]}
      onClose={onClose}
    >
      {!row ? (
        <CostFactsSkeleton rows={4} />
      ) : (
        <CostPanelSection>
          {chartIsComplete && (
            <CostMiniChart
              values={periods.map((period) =>
                period.stats.reduce((sum, s) => sum + parseCost(s.totals), 0),
              )}
            />
          )}
          <Box
            flexDirection="column"
            paddingTop={chartIsComplete ? 's' : 'none'}
          >
            <CostFact
              label="Total"
              value={row ? formatCostAmount(row.total) : null}
            />
            <CostFact
              label="Events"
              value={row?.occurrences.toLocaleString('en-US')}
            />
            <CostFact
              label="Customers"
              value={row?.customers?.toLocaleString('en-US')}
            />
            <CostFact
              label="Average"
              value={
                row?.average !== null && row?.average !== undefined
                  ? formatCostAmount(row.average)
                  : null
              }
            />
          </Box>
        </CostPanelSection>
      )}
      {!samples && <CostListSkeleton />}
      {costed.length >= 2 && (
        <CostPanelSection
          title="Distribution"
          caption={`Last ${costed.length} events`}
        >
          <Box flexDirection="column" paddingTop="s">
            <CostDistributionStrip costs={costed.map(({ cost }) => cost)} />
          </Box>
        </CostPanelSection>
      )}
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
