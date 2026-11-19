'use client'

import { Box } from '@polar-sh/orbit/Box'
import { type ReactNode, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  CondensedTableCell,
  CondensedTableLine,
  type CondensedTableColumn,
  type CondensedTableInset,
} from './columns'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const scrollToRow = (id: string | null) =>
  document
    .querySelector(`[data-condensed-row="${id}"]`)
    ?.scrollIntoView({ block: 'nearest' })

interface CondensedTableProps<T> {
  columns: CondensedTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  selectedId: string | null
  onSelect: (id: string) => void
  // Arrow keys move the selection. Defaults to onSelect.
  onStep?: (id: string) => void
  onClose: () => void
  // A stacked layout for small screens, used in place of the columns.
  renderCompact?: (row: T) => ReactNode
  inset?: CondensedTableInset
}

export const CondensedTable = <T,>({
  columns,
  rows,
  getRowId,
  selectedId,
  onSelect,
  onStep = onSelect,
  onClose,
  renderCompact,
  inset = 'm',
}: CondensedTableProps<T>) => {
  const ids = rows.map(getRowId)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && selectedId) {
        onClose()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const index = selectedId ? ids.indexOf(selectedId) : -1
      const next =
        e.key === 'ArrowDown'
          ? ids[index + 1]
          : index > 0
            ? ids[index - 1]
            : undefined
      if (!next) return
      e.preventDefault()
      onStep(next)
      scrollToRow(next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ids, selectedId, onStep, onClose])

  const isSelectedLoaded = selectedId !== null && ids.includes(selectedId)
  useEffect(() => {
    if (isSelectedLoaded) scrollToRow(selectedId)
  }, [selectedId, isSelectedLoaded])

  return (
    <Box flexDirection="column">
      {rows.map((row) => {
        const id = getRowId(row)
        const selected = id === selectedId
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={selected}
            data-condensed-row={id}
            className={twMerge(
              'w-full cursor-pointer text-left',
              selected
                ? 'dark:bg-polar-800 bg-gray-100'
                : 'dark:hover:bg-polar-800/50 hover:bg-gray-50',
            )}
          >
            {renderCompact && (
              <Box
                display={{ base: 'flex', md: 'none' }}
                flexDirection="column"
                gap="xs"
                paddingHorizontal={inset}
                paddingVertical="s"
                borderBottomWidth={1}
                borderStyle="solid"
                borderColor="border-secondary"
              >
                {renderCompact(row)}
              </Box>
            )}
            <CondensedTableLine
              inset={inset}
              desktopOnly={renderCompact !== undefined}
            >
              {columns.map((column) => (
                <CondensedTableCell key={column.key} column={column}>
                  {column.cell(row)}
                </CondensedTableCell>
              ))}
            </CondensedTableLine>
          </button>
        )
      })}
    </Box>
  )
}
