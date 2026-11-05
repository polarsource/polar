import { formatCostAmount } from '@/utils/formatters'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from '@polar-sh/orbit/icons'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  CostSort,
  CostSortKey,
  isCostSortable,
  nextCostSort,
  parseCostSort,
} from './costSorting'
import { CostGroupBy } from './costRanges'
import { CostRow } from './useCostBreakdown'

const formatChange = (row: CostRow) => {
  if (row.previous === null) return null
  if (row.previous === 0) return { label: 'New', up: null }
  const pct = ((row.total - row.previous) / row.previous) * 100
  if (Math.abs(pct) < 0.5) return { label: '0%', up: null }
  return { label: `${Math.abs(pct).toFixed(0)}%`, up: pct > 0 }
}

const ShareBar = ({ share }: { share: number }) => (
  <Box
    width="100%"
    height={4}
    backgroundColor="background-secondary"
    overflow="hidden"
  >
    <Box
      height="100%"
      width={`${Math.max(share * 100, 1)}%`}
      backgroundColor="background-inverse"
      opacity={0.8}
    />
  </Box>
)

const Change = ({ row }: { row: CostRow }) => {
  const change = formatChange(row)
  if (!change) return null
  return (
    <Box alignItems="center" gap="xs" justifyContent="end">
      {change.up !== null && (
        // Spend going up is the bad direction here.
        <Box color={change.up ? 'text-danger' : 'text-success'}>
          {change.up ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
        </Box>
      )}
      <Text color={change.up === null ? 'muted' : undefined} tabularNums>
        {change.label}
      </Text>
    </Box>
  )
}

const Columns = ({
  compact,
  name,
  share,
  events,
  average,
  change,
  total,
}: { compact: boolean } & Record<
  'name' | 'share' | 'events' | 'average' | 'change' | 'total',
  ReactNode
>) => (
  <>
    <Box flexGrow={2} flexBasis={0} minWidth={160} flexDirection="column">
      {name}
    </Box>
    <Box
      display={compact ? 'none' : { base: 'none', lg: 'flex' }}
      flexGrow={1}
      flexBasis={0}
      minWidth={0}
      maxWidth={160}
    >
      {share}
    </Box>
    <Box
      display={{ base: 'none', md: 'flex' }}
      width={80}
      flexShrink={0}
      justifyContent="end"
    >
      {events}
    </Box>
    <Box
      display={compact ? 'none' : { base: 'none', md: 'flex' }}
      width={88}
      flexShrink={0}
      justifyContent="end"
    >
      {average}
    </Box>
    <Box width={72} flexShrink={0} justifyContent="end">
      {change}
    </Box>
    <Box width={96} flexShrink={0} justifyContent="end">
      {total}
    </Box>
  </>
)

const SortHeading = ({
  label,
  sortKey,
  sort,
  onSortChange,
  align = 'end',
}: {
  label: string
  sortKey: CostSortKey | null
  sort: CostSort
  onSortChange: (sort: CostSort) => void
  align?: 'start' | 'end'
}) => {
  if (sortKey === null) return <Text color="muted">{label}</Text>
  const { key, descending } = parseCostSort(sort)
  const active = key === sortKey
  const Arrow = descending ? ChevronDown : ChevronUp
  return (
    <button
      type="button"
      onClick={() => onSortChange(nextCostSort(sort, sortKey))}
      aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}
      className={twMerge(
        'flex min-w-0 cursor-pointer items-center gap-1',
        align === 'end' && 'ml-auto',
      )}
    >
      <Text color={active ? undefined : 'muted'} truncate>
        {label}
      </Text>
      {active && <Arrow className="h-3 w-3 shrink-0" />}
    </button>
  )
}

export const CostBreakdownHeader = ({
  groupBy,
  groupLabel,
  compact,
  sort,
  onSortChange,
}: {
  groupBy: CostGroupBy
  groupLabel: string
  compact: boolean
  sort: CostSort
  onSortChange: (sort: CostSort) => void
}) => {
  const sortable = (key: CostSortKey) =>
    isCostSortable(groupBy, key) ? key : null
  const heading = (label: string, sortKey: CostSortKey) => (
    <SortHeading
      label={label}
      sortKey={sortable(sortKey)}
      sort={sort}
      onSortChange={onSortChange}
    />
  )
  return (
    <Box
      gap="l"
      alignItems="center"
      paddingHorizontal="m"
      paddingVertical="s"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Columns
        compact={compact}
        name={
          <SortHeading
            label={groupLabel}
            sortKey={sortable('name')}
            sort={sort}
            onSortChange={onSortChange}
            align="start"
          />
        }
        share={<Text color="muted">Share</Text>}
        events={heading('Events', 'events')}
        average={heading('Average', 'average')}
        change={<Text color="muted">Change</Text>}
        total={heading('Total', 'total')}
      />
    </Box>
  )
}

export const CostBreakdownRow = ({
  row,
  compact,
  selected,
  onSelect,
}: {
  row: CostRow
  compact: boolean
  selected: boolean
  onSelect?: () => void
}) => {
  const content = (
    <Box
      gap="l"
      alignItems="center"
      paddingHorizontal="m"
      paddingVertical="s"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Columns
        compact={compact}
        name={
          <>
            <Text truncate>{row.label}</Text>
            {row.detail && (
              <Text variant="caption" color="muted" truncate>
                {row.detail}
              </Text>
            )}
          </>
        }
        share={<ShareBar share={row.share} />}
        events={
          <Text color="muted" tabularNums>
            {row.occurrences.toLocaleString('en-US')}
          </Text>
        }
        average={
          <Text color="muted" tabularNums>
            {row.average !== null ? formatCostAmount(row.average) : ''}
          </Text>
        }
        change={<Change row={row} />}
        total={<Text tabularNums>{formatCostAmount(row.total)}</Text>}
      />
    </Box>
  )

  if (!onSelect) return content

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={twMerge(
        'w-full cursor-pointer text-left',
        selected
          ? 'dark:bg-polar-800 bg-gray-100'
          : 'dark:hover:bg-polar-800/50 hover:bg-gray-50',
      )}
    >
      {content}
    </button>
  )
}
