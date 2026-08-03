'use client'

import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import FilterListOutlined from '@mui/icons-material/FilterListOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@polar-sh/ui/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { CheckIcon } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface FilterOption {
  value: string
  label: string
}

interface FilterBase {
  key: string
  label: string
  icon?: React.ReactNode
  options: FilterOption[]
  searchPlaceholder?: string
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
  loading?: boolean
}

export interface SingleFilter extends FilterBase {
  type: 'single'
  value: string | null
  onChange: (value: string | null) => void
}

export interface MultiFilter extends FilterBase {
  type: 'multi'
  value: string[]
  onChange: (value: string[]) => void
}

export type Filter = SingleFilter | MultiFilter

const itemClassName =
  "gap-3 rounded-lg px-3 py-3 text-black data-[selected='true']:bg-transparent data-[selected=true]:text-black hover:bg-gray-100 active:bg-gray-100 dark:text-white dark:data-[selected=true]:text-white dark:hover:bg-polar-600 dark:active:bg-polar-600"

const crossfadeClassName = (hidden: boolean): string =>
  twMerge(
    'w-full transition-[opacity,filter] duration-100 ease-out motion-reduce:transition-none',
    hidden ? 'opacity-0 blur-[2px]' : 'opacity-100 blur-0',
  )

const isActive = (filter: Filter): boolean =>
  filter.type === 'single' ? filter.value !== null : filter.value.length > 0

const isSelected = (filter: Filter, option: FilterOption): boolean =>
  filter.type === 'single'
    ? filter.value === option.value
    : filter.value.includes(option.value)

const clearFilter = (filter: Filter): void => {
  if (filter.type === 'single') {
    filter.onChange(null)
  } else {
    filter.onChange([])
  }
}

const toggleOption = (filter: Filter, option: FilterOption): void => {
  if (filter.type === 'single') {
    filter.onChange(filter.value === option.value ? null : option.value)
  } else {
    filter.onChange(
      filter.value.includes(option.value)
        ? filter.value.filter((value) => value !== option.value)
        : [...filter.value, option.value],
    )
  }
}

const filterSummary = (filter: Filter): string | null => {
  if (!isActive(filter)) {
    return null
  }
  if (filter.type === 'single') {
    return (
      filter.options.find(({ value }) => value === filter.value)?.label ?? null
    )
  }
  if (filter.value.length === 1) {
    return (
      filter.options.find(({ value }) => value === filter.value[0])?.label ??
      '1 selected'
    )
  }
  return `${filter.value.length} selected`
}

interface FilterPopoverProps {
  filters: Filter[]
  label?: string
  className?: string
}

const FilterPopover: React.FC<FilterPopoverProps> = ({
  filters,
  label = 'Filters',
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeFilter = filters.find(({ key }) => key === activeKey)
  const activeCount = filters.filter(isActive).length
  const isSearchable = !!activeFilter?.onSearchQueryChange

  const collapseSearch = () => {
    setSearchExpanded(false)
    searchInputRef.current?.blur()
    activeFilter?.onSearchQueryChange?.('')
  }

  useEffect(() => {
    if (searchExpanded) {
      searchInputRef.current?.focus()
    }
  }, [searchExpanded])

  const onOpenChange = (value: boolean) => {
    setOpen(value)
    setActiveKey(null)
    collapseSearch()
  }

  const goBack = () => {
    setActiveKey(null)
    collapseSearch()
  }

  const onSelectOption = (filter: Filter, option: FilterOption) => {
    toggleOption(filter, option)
    if (filter.type === 'single') {
      onOpenChange(false)
    }
  }

  const clearAll = () => {
    for (const filter of filters) {
      if (isActive(filter)) {
        clearFilter(filter)
      }
    }
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className={twMerge('flex flex-row items-center', className)}
          wrapperClassNames="gap-x-2"
        >
          <FilterListOutlined fontSize="inherit" />
          <Text>{label}</Text>
          {activeCount > 0 && (
            <Box
              as="span"
              alignItems="center"
              justifyContent="center"
              borderRadius="full"
              backgroundColor="background-primary"
              minWidth={20}
              height={20}
              paddingHorizontal="xs"
            >
              <Text as="span" variant="caption">
                {activeCount}
              </Text>
            </Box>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="dark:border-polar-600 dark:bg-polar-700 min-w-72 overflow-hidden rounded-2xl p-0"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        side="bottom"
        align="start"
      >
        <Command
          className="rounded-2xl bg-transparent"
          shouldFilter={false}
          onKeyDown={(e) => {
            if (activeFilter && !searchExpanded && e.key === 'Backspace') {
              e.preventDefault()
              goBack()
            }
          }}
        >
          {activeFilter && (
            <>
              <Box alignItems="center" columnGap="xs" padding="s">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goBack}
                  aria-label="Back to filters"
                >
                  <ArrowBackOutlined fontSize="inherit" />
                </Button>
                <Box position="relative" flex={1} height={32}>
                  <Box
                    position="absolute"
                    inset={0}
                    alignItems="center"
                    pointerEvents={searchExpanded ? 'none' : 'auto'}
                  >
                    <div className={crossfadeClassName(searchExpanded)}>
                      <Text as="span" color="muted" truncate>
                        {activeFilter.label}
                      </Text>
                    </div>
                  </Box>
                  {isSearchable && (
                    <Box
                      position="absolute"
                      inset={0}
                      alignItems="center"
                      pointerEvents={searchExpanded ? 'auto' : 'none'}
                    >
                      <CommandInput
                        ref={searchInputRef}
                        tabIndex={searchExpanded ? 0 : -1}
                        aria-hidden={!searchExpanded}
                        className="h-8 rounded-none border-none shadow-none ring-0 outline-none focus:ring-0 focus:outline-none"
                        wrapperClassName={twMerge(
                          'border-b-0 px-0 [&>svg]:hidden',
                          crossfadeClassName(!searchExpanded),
                        )}
                        placeholder={
                          activeFilter.searchPlaceholder ?? 'Search…'
                        }
                        value={activeFilter.searchQuery ?? ''}
                        onValueChange={activeFilter.onSearchQueryChange}
                      />
                    </Box>
                  )}
                </Box>
                {isSearchable && (
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={searchExpanded ? 'Close search' : 'Search'}
                    onClick={() =>
                      searchExpanded
                        ? collapseSearch()
                        : setSearchExpanded(true)
                    }
                  >
                    <SearchOutlined fontSize="inherit" />
                  </Button>
                )}
              </Box>
              <CommandSeparator
                className="dark:bg-polar-600 mx-0"
                alwaysRender
              />
            </>
          )}
          <CommandList>
            {activeFilter ? (
              <CommandGroup>
                {activeFilter.options.length === 0 && (
                  <Box justifyContent="center" paddingVertical="l">
                    <Text as="span" color="muted">
                      {activeFilter.loading ? 'Loading…' : 'No results found'}
                    </Text>
                  </Box>
                )}
                {activeFilter.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => onSelectOption(activeFilter, option)}
                    className={itemClassName}
                  >
                    <Box display="flex" flex={1}>
                      <Text as="span" truncate>
                        {option.label}
                      </Text>
                    </Box>
                    <CheckIcon
                      className={twMerge(
                        'h-4 w-4',
                        isSelected(activeFilter, option)
                          ? 'visible'
                          : 'invisible',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <>
                <CommandGroup>
                  {filters.map((filter) => {
                    const summary = filterSummary(filter)
                    return (
                      <CommandItem
                        key={filter.key}
                        value={filter.label}
                        onSelect={() => setActiveKey(filter.key)}
                        className={itemClassName}
                      >
                        {filter.icon}
                        <Box display="flex" flex={1}>
                          <Text as="span" truncate>
                            {filter.label}
                          </Text>
                        </Box>
                        {summary ? (
                          <Text as="span" variant="caption" color="muted">
                            {summary}
                          </Text>
                        ) : null}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                {activeCount > 0 && (
                  <>
                    <CommandSeparator className="dark:bg-polar-600" />
                    <CommandGroup>
                      <CommandItem
                        onSelect={clearAll}
                        className={itemClassName}
                      >
                        Clear filters
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default FilterPopover
