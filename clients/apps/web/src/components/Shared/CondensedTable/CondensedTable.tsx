'use client'

import { Box } from '@polar-sh/orbit/Box'
import { flexRender, type RowData } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from '@polar-sh/orbit/icons'
import { Fragment, type ReactNode, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  CondensedTableCell,
  CondensedTableExpanderCell,
  CondensedTableLine,
  type CondensedTableInset,
} from './columns'
import { type CondensedTableInstance } from './table'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

// A popover, menu or dialog that holds the focus owns the keys pressed in it.
const isInOverlay = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null

// Whether a key press belongs to something else: it was already handled, the
// focus is in a field, or it is inside a popover, menu or dialog.
export const isKeyHandledElsewhere = (event: KeyboardEvent) =>
  event.defaultPrevented || isTyping(event.target) || isInOverlay(event.target)

const scrollToRow = (id: string | null) =>
  document
    .querySelector(`[data-condensed-row="${id}"]`)
    ?.scrollIntoView({ block: 'nearest' })

// Rows that open in place to show more about themselves, under the row.
export interface CondensedTableExpansion<T extends RowData> {
  // Rows with nothing to open are left as plain lines. All can by default.
  canExpand?: (row: T) => boolean
  isExpanded: (row: T) => boolean
  onToggle: (row: T) => void
  render: (row: T) => ReactNode
}

interface CondensedTableProps<T extends RowData> {
  table: CondensedTableInstance<T>
  selectedId?: string | null
  // Without it, and without an expansion, the rows are not interactive.
  onSelect?: (id: string) => void
  // Arrow keys move the selection. Defaults to onSelect.
  onStep?: (id: string) => void
  onClose?: () => void
  // Whether Escape and the arrow keys act on the selection. Off for a list
  // whose rows open a page, where the keys should scroll as usual.
  navigable?: boolean
  // A stacked layout for small screens, used in place of the columns.
  renderCompact?: (row: T) => ReactNode
  inset?: CondensedTableInset
  expansion?: CondensedTableExpansion<T>
}

export const CondensedTable = <T extends RowData>({
  table,
  selectedId = null,
  onSelect,
  onStep = onSelect,
  onClose,
  navigable = true,
  renderCompact,
  inset = 'm',
  expansion,
}: CondensedTableProps<T>) => {
  const { rows } = table.getRowModel()
  const ids = rows.map((row) => row.id)

  useEffect(() => {
    if (!navigable || !onStep) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isKeyHandledElsewhere(e) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && selectedId) {
        onClose?.()
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
  }, [navigable, ids, selectedId, onStep, onClose])

  const isSelectedLoaded = selectedId !== null && ids.includes(selectedId)
  useEffect(() => {
    if (isSelectedLoaded) scrollToRow(selectedId)
  }, [selectedId, isSelectedLoaded])

  return (
    <Box flexDirection="column">
      {rows.map((row) => {
        const { id, original } = row
        const selected = id === selectedId
        const canExpand =
          expansion !== undefined && (expansion.canExpand?.(original) ?? true)
        const expanded = canExpand && expansion.isExpanded(original)
        const onClick = canExpand
          ? () => expansion.onToggle(original)
          : onSelect
            ? () => onSelect(id)
            : undefined
        const Chevron = expanded ? ChevronDown : ChevronRight
        const content = (
          <>
            {renderCompact && (
              <Box
                display={{ base: 'flex', md: 'none' }}
                flexDirection="column"
                gap="xs"
                paddingHorizontal={inset}
                paddingVertical="s"
                borderBottomWidth={expanded ? 0 : 1}
                borderStyle="solid"
                borderColor="border-secondary"
              >
                {renderCompact(original)}
              </Box>
            )}
            <CondensedTableLine
              inset={inset}
              desktopOnly={renderCompact !== undefined}
              borderless={expanded}
            >
              {expansion && (
                <CondensedTableExpanderCell>
                  {canExpand && (
                    <Box as="span" display="inline-flex" color="text-secondary">
                      <Chevron size={16} aria-hidden />
                    </Box>
                  )}
                </CondensedTableExpanderCell>
              )}
              {row.getAllCells().map((cell) => (
                <CondensedTableCell
                  key={cell.id}
                  column={cell.column.columnDef.meta}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </CondensedTableCell>
              ))}
            </CondensedTableLine>
          </>
        )
        return (
          <Fragment key={id}>
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                aria-current={selected}
                aria-expanded={canExpand ? expanded : undefined}
                data-condensed-row={id}
                className={twMerge(
                  'w-full cursor-pointer text-left',
                  selected
                    ? 'dark:bg-polar-800 bg-gray-100'
                    : 'dark:hover:bg-polar-800/50 hover:bg-gray-50',
                )}
              >
                {content}
              </button>
            ) : (
              <div data-condensed-row={id}>{content}</div>
            )}
            {expanded && (
              <Box
                flexDirection="column"
                paddingBottom="s"
                borderBottomWidth={1}
                borderStyle="solid"
                borderColor="border-secondary"
              >
                {expansion.render(original)}
              </Box>
            )}
          </Fragment>
        )
      })}
    </Box>
  )
}
