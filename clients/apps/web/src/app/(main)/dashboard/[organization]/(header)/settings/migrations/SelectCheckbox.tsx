'use client'

import { Checkbox } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

// The table zeroes padding on any cell holding a checkbox, so the inset has to
// come from here. Orbit's `createSelectionColumn` does the same, but its header
// selects the page rather than the whole catalog.
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
