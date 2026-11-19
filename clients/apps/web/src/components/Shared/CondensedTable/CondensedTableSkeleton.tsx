import { SkeletonBar } from '@/components/Shared/SkeletonBar'
import { Box } from '@polar-sh/orbit/Box'
import {
  CondensedTableCell,
  CondensedTableLine,
  type CondensedTableColumn,
  type CondensedTableInset,
} from './columns'

const ROW_COUNT = 12
const ROW_MIN_HEIGHT = 37
const COMPACT_WIDTHS = [
  [140, 150],
  [180, 130],
  [120, 160],
  [200, 140],
  [160, 120],
  [110, 150],
]

interface CondensedTableSkeletonProps<T> {
  columns: CondensedTableColumn<T>[]
  compact?: boolean
  inset?: CondensedTableInset
}

export const CondensedTableSkeleton = <T,>({
  columns,
  compact = false,
  inset = 'm',
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
          {columns.map((column) => (
            <CondensedTableCell key={column.key} column={column}>
              {column.skeleton && (
                <SkeletonBar
                  width={column.skeleton[index % column.skeleton.length]}
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
