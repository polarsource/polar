import { SkeletonBar } from '@/components/Shared/SkeletonBar'
import { Box } from '@polar-sh/orbit/Box'
import { type RowData } from '@tanstack/react-table'
import {
  CondensedTableCell,
  CondensedTableExpanderCell,
  CondensedTableLine,
  type CondensedTableInset,
} from './columns'
import { type CondensedTableInstance } from './table'

const ROW_COUNT = 12
const ROW_MIN_HEIGHT = 38
const COMPACT_WIDTHS = [
  [140, 150],
  [180, 130],
  [120, 160],
  [200, 140],
  [160, 120],
  [110, 150],
]

interface CondensedTableSkeletonProps<T extends RowData> {
  table: CondensedTableInstance<T>
  compact?: boolean
  inset?: CondensedTableInset
  // Leaves room for the chevron of a table whose rows open in place.
  expandable?: boolean
}

export const CondensedTableSkeleton = <T extends RowData>({
  table,
  compact = false,
  inset = 'm',
  expandable = false,
}: CondensedTableSkeletonProps<T>) => {
  const rows = Array.from({ length: ROW_COUNT }, (_, index) => index)
  return (
    <Box flexDirection="column" aria-busy="true">
      {compact &&
        rows.map((index) => {
          const [title, caption] = COMPACT_WIDTHS[index % COMPACT_WIDTHS.length]
          return (
            <Box
              key={`compact-${index}`}
              display={{ base: 'flex', md: 'none' }}
              flexDirection="column"
              gap="s"
              paddingHorizontal={inset}
              paddingVertical="s"
              borderBottomWidth={1}
              borderStyle="solid"
              borderColor="border-secondary"
            >
              <SkeletonBar width={title} height={14} />
              <SkeletonBar width={caption} height={12} />
            </Box>
          )
        })}
      {rows.map((index) => (
        <CondensedTableLine
          key={index}
          inset={inset}
          desktopOnly={compact}
          minHeight={ROW_MIN_HEIGHT}
        >
          {expandable && <CondensedTableExpanderCell />}
          {table.getAllLeafColumns().map(({ id, columnDef: { meta } }) => (
            <CondensedTableCell key={id} column={meta}>
              {meta?.skeleton && (
                <SkeletonBar
                  width={meta.skeleton[index % meta.skeleton.length]}
                  height={14}
                />
              )}
            </CondensedTableCell>
          ))}
        </CondensedTableLine>
      ))}
    </Box>
  )
}
