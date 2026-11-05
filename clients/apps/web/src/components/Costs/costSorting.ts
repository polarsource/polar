import { CostGroupBy } from './costRanges'

export type CostSortKey = 'name' | 'events' | 'average' | 'total'
export type CostSort = CostSortKey | `-${CostSortKey}`

const KEYS: CostSortKey[] = ['name', 'events', 'average', 'total']

export const COST_SORTS: CostSort[] = KEYS.flatMap((key) => [
  key,
  `-${key}` as const,
])

export const DEFAULT_COST_SORT: CostSort = '-total'

// The API field each column sorts by, per grouping. Customer names come from
// Postgres after the Tinybird query, so they can't be sorted there.
const SERVER_FIELDS: Record<
  CostGroupBy,
  Partial<Record<CostSortKey, string>>
> = {
  type: {
    name: 'name',
    events: 'occurrences',
    average: 'average',
    total: 'total',
  },
  customer: { events: 'occurrences', average: 'average', total: 'total' },
  model: {
    name: 'value',
    events: 'occurrences',
    average: 'average',
    total: 'total',
  },
  vendor: {
    name: 'value',
    events: 'occurrences',
    average: 'average',
    total: 'total',
  },
}

export const parseCostSort = (sort: CostSort) => ({
  key: (sort.startsWith('-') ? sort.slice(1) : sort) as CostSortKey,
  descending: sort.startsWith('-'),
})

export const isCostSortable = (groupBy: CostGroupBy, key: CostSortKey) =>
  SERVER_FIELDS[groupBy][key] !== undefined

export const toServerSorting = (
  groupBy: CostGroupBy,
  sort: CostSort,
): string[] => {
  const { key, descending } = parseCostSort(sort)
  const field = SERVER_FIELDS[groupBy][key] ?? 'total'
  return [`${descending ? '-' : ''}${field}`]
}

// Clicking the active column flips it; a new column starts with the order
// people usually want first: names A to Z, numbers largest first.
export const nextCostSort = (current: CostSort, key: CostSortKey): CostSort => {
  const { key: currentKey, descending } = parseCostSort(current)
  if (currentKey === key) return descending ? key : `-${key}`
  return key === 'name' ? key : `-${key}`
}
