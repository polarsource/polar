'use client'

import { Box } from '@polar-sh/orbit/Box'

type ChipOption =
  | string
  | [value: string, label: string]
  | { value: string; label: string }

function normalizeOption(option: ChipOption): { value: string; label: string } {
  if (typeof option === 'string') return { value: option, label: option }
  if (Array.isArray(option)) return { value: option[0], label: option[1] }
  return option
}

interface ChipSelectProps {
  options: readonly ChipOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  single?: boolean
}

export function ChipSelect({
  options,
  selected,
  onChange,
  single = false,
}: ChipSelectProps) {
  const toggle = (value: string) => {
    if (single) {
      onChange(selected.includes(value) ? [] : [value])
      return
    }
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <Box display="flex" flexWrap="wrap" gap="s">
      {options.map((option) => {
        const { value, label } = normalizeOption(option)
        const isSelected = selected.includes(value)
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors ${
              isSelected
                ? 'dark:bg-polar-700 dark:text-polar-50 dark:border-polar-600 border-gray-300 bg-gray-100 font-medium text-gray-950'
                : 'dark:border-polar-700 dark:text-polar-400 dark:hover:border-polar-500 border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            {label}
          </button>
        )
      })}
    </Box>
  )
}
