'use client'

import { Checkbox } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

// Mirrors migrations/SelectCheckbox: stopPropagation so row click opens the
// modal instead of toggling selection.
export function CurrentSelectCheckbox({
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
        onClick={(event) => event.stopPropagation()}
      />
    </Box>
  )
}
