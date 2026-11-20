'use client'

import {
  isFilterActive,
  isFilterDefaulted,
  type Filter,
  type FilterOption,
} from '@/components/Shared/FilterPopover'
import { Button } from '@polar-sh/orbit'
import {
  Check,
  ChevronRight,
  FilterListOutlined,
  FunnelX,
} from '@polar-sh/orbit/icons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// Filled while the menu is open or anything is applied, in place of a badge.
const TRIGGER_ON_CLASS = 'dark:bg-polar-700 bg-gray-200'
const PANEL_CLASS =
  'dark:bg-polar-800 dark:border-polar-700 rounded-xl border border-gray-200 bg-white text-[13px] shadow-xl'
const SEARCH_CLASS =
  'dark:placeholder:text-polar-500 dark:border-polar-700 dark:focus:border-polar-700 w-full rounded-t-xl border-x-0 border-t-0 border-b border-gray-200 bg-transparent px-3.5 py-2 text-[13px] outline-none placeholder:text-gray-400 focus:border-gray-200 focus:ring-0 focus:outline-none'
const ITEM_CLASS =
  'flex h-7 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left'
const ITEM_ACTIVE_CLASS = 'dark:bg-polar-700 bg-gray-100'
const ITEM_HOVER_CLASS = 'dark:hover:bg-polar-700 hover:bg-gray-100'
const ICON_CLASS =
  'dark:text-polar-400 size-3.5 shrink-0 text-gray-500 [&_svg]:size-3.5'
const CHECKBOX_CLASS =
  'dark:border-polar-500 flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-gray-300'
const CHECKBOX_ON_CLASS =
  'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
const EMPTY_CLASS = 'dark:text-polar-500 px-2 py-1.5 text-gray-400'

const matches = (label: string, query: string) =>
  label.toLowerCase().includes(query.trim().toLowerCase())

const isSelected = (filter: Filter, option: FilterOption) =>
  filter.type === 'single'
    ? filter.value === option.value
    : filter.value.includes(option.value)

const OptionsPanel = ({
  filter,
  onPicked,
}: {
  filter: Filter
  onPicked: () => void
}) => {
  const [localQuery, setLocalQuery] = useState('')
  // A filter that searches for itself gets the text and returns its matches.
  const isRemote = filter.onSearchQueryChange !== undefined
  const query = isRemote ? (filter.searchQuery ?? '') : localQuery
  const setQuery = filter.onSearchQueryChange ?? setLocalQuery
  const options = isRemote
    ? filter.options
    : filter.options.filter(({ label }) => matches(label, query))
  const pick = (option: FilterOption) => {
    if (filter.type === 'single') {
      filter.onChange(option.value)
      onPicked()
      return
    }
    filter.onChange(
      filter.value.includes(option.value)
        ? filter.value.filter((value) => value !== option.value)
        : [...filter.value, option.value],
    )
  }

  return (
    <div className={twMerge(PANEL_CLASS, 'w-64')}>
      {filter.searchPlaceholder && (
        <input
          autoFocus
          className={SEARCH_CLASS}
          placeholder={filter.searchPlaceholder}
          aria-label={`Filter ${filter.label.toLowerCase()} options`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <div className="max-h-72 overflow-y-auto p-1.5">
        {options.length === 0 && (
          <div className={EMPTY_CLASS}>
            {filter.loading ? 'Loading...' : 'No matches'}
          </div>
        )}
        {options.map((option) => {
          const isOn = isSelected(filter, option)
          return (
            <button
              key={option.value}
              type="button"
              role={
                filter.type === 'multi' ? 'menuitemcheckbox' : 'menuitemradio'
              }
              aria-checked={isOn}
              className={twMerge(ITEM_CLASS, ITEM_HOVER_CLASS)}
              onClick={() => pick(option)}
            >
              {filter.type === 'multi' ? (
                <span
                  className={twMerge(CHECKBOX_CLASS, isOn && CHECKBOX_ON_CLASS)}
                >
                  {isOn && <Check className="size-2.5" strokeWidth={3} />}
                </span>
              ) : (
                <span className="flex size-3.5 shrink-0 items-center">
                  {isOn && <Check className="size-3.5" />}
                </span>
              )}
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface ToolbarFilterMenuProps {
  filters: Filter[]
  // Offered at the foot of the menu while there is something to reset.
  onReset?: () => void
  className?: string
}

// A list of properties, each opening its options beside it.
export const ToolbarFilterMenu = ({
  filters,
  onReset,
  className,
}: ToolbarFilterMenuProps) => {
  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const hasApplied = filters.some(
    (filter) => isFilterActive(filter) && !isFilterDefaulted(filter),
  )
  // Leaving a property clears what was typed into its search.
  const activate = (key: string | null) => {
    if (key === activeKey) return
    filters
      .find((filter) => filter.key === activeKey)
      ?.onSearchQueryChange?.('')
    setActiveKey(key)
  }
  const onOpenChange = (value: boolean) => {
    setOpen(value)
    activate(null)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={twMerge(
            'h-7 w-7 [&_svg]:size-4!',
            (hasApplied || open) && TRIGGER_ON_CLASS,
            className,
          )}
          aria-label={hasApplied ? 'Filters, some applied' : 'Filters'}
          title="Filters"
        >
          <FilterListOutlined fontSize="inherit" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={twMerge(PANEL_CLASS, 'w-60 overflow-visible p-0')}
      >
        <div className="p-1.5">
          {filters.map((filter) => {
            const isActive = filter.key === activeKey
            return (
              <div
                key={filter.key}
                className="relative"
                onMouseEnter={() => activate(filter.key)}
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isActive}
                  className={twMerge(
                    ITEM_CLASS,
                    ITEM_HOVER_CLASS,
                    isActive && ITEM_ACTIVE_CLASS,
                  )}
                  onClick={() => activate(filter.key)}
                >
                  <span className={ICON_CLASS}>{filter.icon}</span>
                  <span className="grow truncate">{filter.label}</span>
                  <ChevronRight className="size-3 opacity-50" />
                </button>
                {isActive && (
                  // Padded, not offset, so the pointer can cross the gap.
                  <div className="absolute top-0 right-full -mt-[7px] pr-3">
                    <OptionsPanel
                      filter={filter}
                      onPicked={() => onOpenChange(false)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {onReset && (
          <div
            className="dark:border-polar-700 border-t border-gray-200 p-1.5"
            onMouseEnter={() => activate(null)}
          >
            <button
              type="button"
              className={twMerge(ITEM_CLASS, ITEM_HOVER_CLASS)}
              onClick={() => {
                onReset()
                onOpenChange(false)
              }}
            >
              <span className={ICON_CLASS}>
                <FunnelX />
              </span>
              Reset filters
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
