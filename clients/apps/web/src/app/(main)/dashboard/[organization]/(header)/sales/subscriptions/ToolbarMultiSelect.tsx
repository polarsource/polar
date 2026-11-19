import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, ChevronDown } from '@polar-sh/orbit/icons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'

// Matches the trigger and the items of ToolbarSelect, which come from Select.
const TRIGGER_CLASS =
  'dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 flex h-8 cursor-pointer items-center gap-x-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs text-black transition-colors hover:border-gray-300 dark:text-white'
const ITEM_CLASS =
  'dark:hover:bg-polar-700 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-gray-100'

interface ToolbarMultiSelectProps<T extends string> {
  label: string
  emptyLabel: string
  value: T[]
  options: { value: T; label: string }[]
  onChange: (value: T[]) => void
}

export const ToolbarMultiSelect = <T extends string>({
  label,
  emptyLabel,
  value,
  options,
  onChange,
}: ToolbarMultiSelectProps<T>) => {
  const selected = options.filter((option) => value.includes(option.value))
  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.map((option) => option.label).join(', ')
  // Kept in the order of the options, whatever order they were picked in.
  const toggle = (toggled: T) =>
    onChange(
      options
        .map((option) => option.value)
        .filter((option) =>
          option === toggled ? !value.includes(option) : value.includes(option),
        ),
    )

  return (
    <Popover>
      <PopoverTrigger aria-label={label} className={TRIGGER_CLASS}>
        <span className="whitespace-nowrap">{summary}</span>
        <ChevronDown className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="dark:bg-polar-800 w-44 rounded-xl border-none p-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemcheckbox"
            aria-checked={value.includes(option.value)}
            className={ITEM_CLASS}
            onClick={() => toggle(option.value)}
          >
            <Text variant="caption">{option.label}</Text>
            <Box width={16} height={16} alignItems="center">
              {value.includes(option.value) && <Check className="size-4" />}
            </Box>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
