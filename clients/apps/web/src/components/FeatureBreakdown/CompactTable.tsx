import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MoveDown, MoveUp } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CompactColumn<T> {
  id: string
  title: string
  cell: (row: T) => ReactNode
  // Fixed width in pixels; columns without one share the remaining space.
  width?: number
  grow?: number
  minWidth?: number
  align?: 'start' | 'end'
  sort?: (row: T) => number | string
  // Dropped first when the table is too narrow for every column.
  wide?: boolean
}

export type CompactSort = { id: string; desc: boolean }

// Flexible columns hold names; below this the table scrolls instead.
const NAME_MIN_WIDTH = 120
const GAP = 24
const PADDING = 12

const requiredWidth = <T,>(columns: CompactColumn<T>[]) =>
  columns.reduce(
    (sum, c) => sum + (c.width ?? c.minWidth ?? NAME_MIN_WIDTH),
    GAP * (columns.length - 1) + PADDING * 2,
  )

const useWidth = () => {
  const ref = useRef<HTMLElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

const ROW_CLASS = 'w-full text-left'
const HOVER_CLASS = 'dark:hover:bg-polar-800/50 hover:bg-gray-50'
const ACTIVE_CLASS = 'dark:bg-polar-800 bg-gray-100'

function Cells<T>({
  columns,
  render,
  header = false,
}: {
  columns: CompactColumn<T>[]
  render: (column: CompactColumn<T>) => ReactNode
  header?: boolean
}) {
  return (
    <Box
      alignItems="center"
      gap="xl"
      paddingHorizontal="m"
      paddingVertical="s"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor={header ? 'border-primary' : 'border-secondary'}
    >
      {columns.map((column) => (
        <Box
          key={column.id}
          width={column.width}
          flexShrink={column.width ? 0 : 1}
          flexGrow={column.width ? 0 : (column.grow ?? 1)}
          flexBasis={column.width ? undefined : 0}
          minWidth={column.minWidth ?? (column.width ? 0 : NAME_MIN_WIDTH)}
          justifyContent={column.align === 'end' ? 'end' : 'start'}
        >
          {render(column)}
        </Box>
      ))}
    </Box>
  )
}

// The compact, borderless table of the event explorer: ruled rows, a muted
// header and sortable columns.
export function CompactTable<T>({
  columns: allColumns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  isActive,
  onRowHover,
  defaultSort,
}: {
  columns: CompactColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string | null
  onRowClick?: (row: T) => void
  isActive?: (row: T) => boolean
  onRowHover?: (row: T | null) => void
  defaultSort?: CompactSort
}) {
  const [sort, setSort] = useState<CompactSort | null>(defaultSort ?? null)
  const { ref, width } = useWidth()
  const visible =
    width !== null && width < requiredWidth(allColumns)
      ? allColumns.filter((column) => !column.wide)
      : allColumns
  const columns = visible
  const sortBy = allColumns.find((column) => column.id === sort?.id)?.sort
  const sorted =
    sort && sortBy
      ? rows.toSorted((a, b) => {
          const left = sortBy(a)
          const right = sortBy(b)
          const order =
            typeof left === 'number' && typeof right === 'number'
              ? left - right
              : String(left).localeCompare(String(right))
          return sort.desc ? -order : order
        })
      : rows

  return (
    <Box ref={ref} overflowX="auto">
      <Box flexDirection="column" flexGrow={1} minWidth="max-content">
        <Cells
          header
          columns={columns}
          render={(column) => {
            const active = sort?.id === column.id
            const label = (
              <Box alignItems="center" gap="xs">
                <Text color={active ? undefined : 'muted'} truncate>
                  {column.title}
                </Text>
                {active &&
                  (sort.desc ? (
                    <MoveDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <MoveUp className="h-3 w-3 shrink-0" />
                  ))}
              </Box>
            )
            return column.sort ? (
              <button
                type="button"
                className="cursor-pointer"
                onClick={() =>
                  setSort({
                    id: column.id,
                    desc: active ? !sort.desc : true,
                  })
                }
              >
                {label}
              </button>
            ) : (
              label
            )
          }}
        />
        {sorted.map((row) => {
          const cells = <Cells columns={columns} render={(c) => c.cell(row)} />
          const className = twMerge(
            ROW_CLASS,
            isActive?.(row) ? ACTIVE_CLASS : HOVER_CLASS,
          )
          const href = rowHref?.(row)
          const hover = onRowHover && {
            onMouseEnter: () => onRowHover(row),
            onMouseLeave: () => onRowHover(null),
          }
          if (href) {
            return (
              <Link
                key={rowKey(row)}
                href={href}
                className={className}
                {...hover}
              >
                {cells}
              </Link>
            )
          }
          if (onRowClick) {
            return (
              <button
                key={rowKey(row)}
                type="button"
                onClick={() => onRowClick(row)}
                className={twMerge(className, 'cursor-pointer')}
                {...hover}
              >
                {cells}
              </button>
            )
          }
          return (
            <div key={rowKey(row)} className={className} {...hover}>
              {cells}
            </div>
          )
        })}
      </Box>
    </Box>
  )
}
