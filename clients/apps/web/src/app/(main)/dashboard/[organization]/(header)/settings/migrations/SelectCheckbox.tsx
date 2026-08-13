'use client'

import { Checkbox } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

// The table zeroes the padding of any cell holding a checkbox
// (`[&:has([role=checkbox])]:p-0`), so a selection column has to put the inset
// back itself. Without this the checkbox sits flush against the table edge
// while every other column is indented, and the column reads as misaligned.
//
// Orbit's own `createSelectionColumn` does the same thing, but its header
// selects the current page; the migration tables select across the whole
// catalog, so they build their own column and share this cell.
export function SelectCheckbox({
  checked,
  disabled = false,
  ariaLabel,
  onToggle,
}: {
  checked: boolean | 'indeterminate'
  disabled?: boolean
  ariaLabel: string
  onToggle?: () => void
}) {
  return (
    <Box alignItems="center" paddingLeft="l">
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onCheckedChange={() => onToggle?.()}
        // The row itself opens the detail modal.
        onClick={(event) => event.stopPropagation()}
      />
    </Box>
  )
}
