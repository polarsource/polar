import {
  clearFilter,
  isFilterActive,
  isFilterDefaulted,
  type Filter,
} from '@/components/Shared/FilterPopover'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { X } from '@polar-sh/orbit/icons'
import { type ReactNode } from 'react'

const CHIP_HEIGHT = 26
const MAX_NAMED_VALUES = 2
const REMOVE_CLASS =
  'dark:text-polar-500 flex h-full cursor-pointer items-center px-1.5 text-gray-400 transition-colors hover:text-black dark:hover:text-white'

const getValueLabel = (filter: Filter): string => {
  if (filter.valueLabel) return filter.valueLabel
  const values = filter.type === 'single' ? [filter.value] : filter.value
  const labels = values.map(
    (value) =>
      filter.options.find((option) => option.value === value)?.label ?? value,
  )
  return labels.length > MAX_NAMED_VALUES
    ? `${labels.length} selected`
    : labels.join(', ')
}

// One chip per filter that is away from its default, each removable. They sit
// in the toolbar, and the row clips what does not fit.
export const ToolbarFilterChips = ({
  filters,
  trailing,
}: {
  filters: Filter[]
  // Follows the last chip, and is never clipped.
  trailing?: ReactNode
}) => {
  const applied = filters.filter(
    (filter) => isFilterActive(filter) && !isFilterDefaulted(filter),
  )
  if (applied.length === 0) return null

  return (
    <Box alignItems="center" gap="s" minWidth={0}>
      <Box alignItems="center" gap="s" minWidth={0} overflow="hidden">
        {applied.map((filter) => (
          <Box
            key={filter.key}
            alignItems="center"
            height={CHIP_HEIGHT}
            borderRadius="s"
            backgroundColor="background-card"
            overflow="hidden"
            flexShrink={0}
          >
            <Box alignItems="center" gap="s" pl="s" minWidth={0}>
              <Text variant="caption" color="muted" wrap="nowrap">
                {filter.label}
              </Text>
              <Text variant="caption" truncate>
                {getValueLabel(filter)}
              </Text>
            </Box>
            <button
              type="button"
              className={REMOVE_CLASS}
              aria-label={`Remove ${filter.label.toLowerCase()} filter`}
              onClick={() => clearFilter(filter)}
            >
              <X className="size-3.5" />
            </button>
          </Box>
        ))}
      </Box>
      {trailing}
    </Box>
  )
}
