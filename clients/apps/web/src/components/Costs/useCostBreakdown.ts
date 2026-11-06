import { schemas } from '@polar-sh/client'
import {
  useEventCustomerStats,
  useEventHierarchyStats,
  useEventPropertyGroupStats,
} from '@/hooks/queries/events'
import {
  CostGroupBy,
  CostRange,
  parseCost,
  previousCostRange,
  toStatsDates,
} from './costRanges'
import { CostSort, DEFAULT_COST_SORT, toServerSorting } from './costSorting'

export interface CostRow {
  key: string
  label: string
  detail: string | null
  total: number
  previous: number | null
  share: number
  occurrences: number
  customers: number | null
  average: number | null
  eventTypeId: string | null
  eventName: string | null
  customerId: string | null
}

type BaseRow = Omit<CostRow, 'share' | 'previous'>

const AGGREGATE = ['_cost.amount']
// Customer and property breakdowns return at most this many rows.
const GROUP_LIMIT = 100

const useGroupedCosts = (
  organizationId: string,
  groupBy: CostGroupBy,
  range: CostRange,
  customerIds: string[] | null,
  sort: CostSort,
): { rows: BaseRow[] | undefined; isLoading: boolean } => {
  const dates = toStatsDates(range)
  const sorting = toServerSorting(groupBy, sort)
  const customer_id = customerIds && customerIds.length > 0 ? customerIds : null
  const params = { ...dates, aggregate_fields: AGGREGATE, customer_id }

  const types = useEventHierarchyStats(
    organizationId,
    {
      ...params,
      interval: 'year',
      sorting: sorting as schemas['EventStatisticsSortProperty'][],
    },
    groupBy === 'type',
  )
  const customers = useEventCustomerStats(
    organizationId,
    {
      ...params,
      limit: GROUP_LIMIT,
      sorting: sorting as schemas['EventCustomerStatisticsSortProperty'][],
    },
    groupBy === 'customer',
  )
  const properties = useEventPropertyGroupStats(
    organizationId,
    groupBy === 'vendor' ? '_llm.vendor' : '_llm.model',
    {
      ...params,
      limit: GROUP_LIMIT,
      sorting: sorting as schemas['EventPropertyStatisticsSortProperty'][],
    },
    groupBy === 'model' || groupBy === 'vendor',
  )

  switch (groupBy) {
    case 'type':
      return {
        isLoading: types.isLoading,
        rows: types.data?.totals.map((stat) => ({
          key: stat.event_type_id,
          label: stat.label,
          detail: stat.label !== stat.name ? stat.name : null,
          total: parseCost(stat.totals),
          occurrences: stat.occurrences,
          customers: stat.customers,
          average: parseCost(stat.averages),
          eventTypeId: stat.event_type_id,
          eventName: stat.name,
          customerId: null,
        })),
      }
    case 'customer':
      return {
        isLoading: customers.isLoading,
        rows: customers.data?.items.map((stat) => {
          const label =
            stat.name ??
            stat.email ??
            stat.external_customer_id ??
            stat.customer_id ??
            'Unattributed'
          return {
            key: stat.customer_id ?? stat.external_customer_id ?? 'none',
            label,
            detail: stat.email && stat.email !== label ? stat.email : null,
            total: parseCost(stat.totals),
            occurrences: stat.occurrences,
            customers: null,
            average: stat.occurrences
              ? parseCost(stat.totals) / stat.occurrences
              : null,
            eventTypeId: null,
            eventName: null,
            customerId: stat.customer_id,
          }
        }),
      }
    default:
      return {
        isLoading: properties.isLoading,
        rows: properties.data?.items.map((stat) => ({
          key: stat.value,
          label: stat.value,
          detail: null,
          total: parseCost(stat.totals),
          occurrences: stat.occurrences,
          customers: stat.customers,
          average: stat.occurrences
            ? parseCost(stat.totals) / stat.occurrences
            : null,
          eventTypeId: null,
          eventName: null,
          customerId: null,
        })),
      }
  }
}

export const useCostBreakdown = (
  organizationId: string,
  groupBy: CostGroupBy,
  range: CostRange,
  customerIds: string[] | null,
  sort: CostSort,
) => {
  const current = useGroupedCosts(
    organizationId,
    groupBy,
    range,
    customerIds,
    sort,
  )
  // Only matched by key, so the previous period keeps the default order.
  const previous = useGroupedCosts(
    organizationId,
    groupBy,
    previousCostRange(range),
    customerIds,
    DEFAULT_COST_SORT,
  )
  // Every cost rolls up to a root event, so the per-type totals add up to the
  // whole period regardless of grouping or how many groups were returned.
  const overall = useEventHierarchyStats(organizationId, {
    ...toStatsDates(range),
    interval: 'year',
    aggregate_fields: AGGREGATE,
    customer_id: customerIds && customerIds.length > 0 ? customerIds : null,
  })

  // Rows arrive in the server's sort order.
  const rows = (current.rows ?? []).filter((row) => row.total > 0)
  const total = (overall.data?.totals ?? []).reduce(
    (sum, stat) => sum + parseCost(stat.totals),
    0,
  )
  const previousByKey = new Map(
    (previous.rows ?? []).map((row) => [row.key, row.total]),
  )
  // A key missing from a truncated previous period may just be outside the
  // top groups, so its change is unknown rather than new.
  const previousIsComplete =
    groupBy === 'type' || (previous.rows?.length ?? 0) < GROUP_LIMIT

  const previousOf = (key: string) => {
    if (!previous.rows) return null
    const value = previousByKey.get(key)
    if (value !== undefined) return value
    return previousIsComplete ? 0 : null
  }

  return {
    isLoading: current.isLoading || overall.isLoading,
    total,
    rows: rows.map(
      (row): CostRow => ({
        ...row,
        share: total > 0 ? row.total / total : 0,
        previous: previousOf(row.key),
      }),
    ),
  }
}
