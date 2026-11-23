import {
  clearFilter,
  isFilterActive,
  isFilterDefaulted,
  type Filter,
} from '@/components/Shared/FilterPopover'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { X } from '@polar-sh/orbit/icons'
import { Fragment, type ReactNode } from 'react'

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

// The icons of what is selected, for options that have one.
const getValueIcons = (filter: Filter): ReactNode[] => {
  const values = filter.type === 'single' ? [filter.value] : filter.value
  return values.flatMap((value) => {
    const icon = filter.options.find((option) => option.value === value)?.icon
    return icon ? [<Fragment key={value}>{icon}</Fragment>] : []
  })
}

// One chip per filter that is away from its default, each removable. They sit
// in the toolbar, and the row scrolls sideways when they do not fit.
export const ToolbarFilterChips = ({
  filters,
  trailing,
}: {
  filters: Filter[]
  // Follows the last chip, and never scrolls away.
  trailing?: ReactNode
}) => {
  const applied = filters.filter(
    (filter) => isFilterActive(filter) && !isFilterDefaulted(filter),
  )
  if (applied.length === 0) return null

  return (
    <Box alignItems="center" gap="s" minWidth={0}>
      <div className="flex min-w-0 [scrollbar-width:none] items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
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
              {getValueIcons(filter)}
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
      </div>
      {trailing}
    </Box>
  )
}
