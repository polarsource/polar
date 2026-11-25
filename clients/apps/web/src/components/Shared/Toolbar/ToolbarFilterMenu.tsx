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
  ChevronDown,
  ChevronRight,
  FilterListOutlined,
  FunnelX,
  Plus,
} from '@polar-sh/orbit/icons'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@polar-sh/ui/components/ui/popover'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { twMerge } from 'tailwind-merge'
import { type ToolbarAction } from './ToolbarActionsMenu'

// Filled while the menu is open or anything is applied, in place of a badge.
const TRIGGER_ON_CLASS = 'dark:bg-polar-700 bg-gray-200'
// Sized to stand beside a filter chip.
const ADD_TRIGGER_CLASS = 'size-[26px] shrink-0 rounded-md [&_svg]:size-3.5!'
// An arrow at the end of an entity link, which shows while the link is
// pointed at, focused, or has its menu open.
const INLINE_TRIGGER_CLASS =
  'dark:text-polar-500 dark:hover:bg-polar-700 flex shrink-0 cursor-pointer items-center justify-center w-5 self-stretch rounded-md text-gray-400 opacity-0 group-hover/entity:opacity-100 hover:bg-gray-200 hover:text-gray-950 focus-visible:opacity-100 data-[state=open]:opacity-100 dark:hover:text-white data-[state=open]:bg-gray-200 data-[state=open]:text-gray-950 dark:data-[state=open]:bg-polar-700 dark:data-[state=open]:text-white'
export const PANEL_CLASS =
  'dark:bg-polar-800 dark:border-polar-700 rounded-xl border border-gray-200 bg-white text-[13px] shadow-xl'
const SEARCH_CLASS =
  'dark:placeholder:text-polar-500 dark:border-polar-700 dark:focus:border-polar-700 w-full rounded-t-xl border-x-0 border-t-0 border-b border-gray-200 bg-transparent px-3.5 py-2 text-[13px] outline-none placeholder:text-gray-400 focus:border-gray-200 focus:ring-0 focus:outline-none'
export const ITEM_CLASS =
  'flex h-7 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left'
const ITEM_ACTIVE_CLASS = 'dark:bg-polar-700 bg-gray-100'
export const ITEM_HOVER_CLASS = 'dark:hover:bg-polar-700 hover:bg-gray-100'
export const ICON_CLASS =
  'dark:text-polar-400 size-3.5 shrink-0 text-gray-500 [&_svg]:size-3.5'
const CHECKBOX_CLASS =
  'dark:border-polar-500 flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-gray-300'
const CHECKBOX_ON_CLASS =
  'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
const EMPTY_CLASS = 'dark:text-polar-500 px-2 py-1.5 text-gray-400'

// How long the pointer can stay on another property, while it looks to be on
// its way to the open options, before that property takes over.
const LINGER_DELAY = 300
// How long a property has to be open before a path towards its options is
// held. A pointer passing through on its way down the list has not stopped to
// look at the options, so it is not aiming for them.
const SETTLE_DELAY = 200
// Slack above and below the options, so a path that skims a corner still counts.
const SAFE_AREA_SLACK = 8
// The pointer's heading is read from where it was this far back, which evens
// out the jitter between two neighbouring events.
const HEADING_DISTANCE = 8
const TRAIL_LENGTH = 12

interface Point {
  x: number
  y: number
}

const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

// Where the pointer was a short distance ago.
const getOrigin = (trail: Point[], point: Point): Point | undefined =>
  trail.findLast(
    ({ x, y }) => Math.hypot(point.x - x, point.y - y) >= HEADING_DISTANCE,
  ) ?? trail[0]

// Whether the pointer is heading for the open options: it lies inside the
// triangle between where it just was and the near edge of the options. Moving
// straight along the list falls outside it, moving across towards the options
// falls inside.
const isHeadingForOptions = (
  point: Point,
  origin: Point,
  options: DOMRect,
  opensRight: boolean,
) => {
  const x = opensRight ? options.left : options.right
  // Already level with the options' edge, so there is no path left to hold.
  if (opensRight ? origin.x >= x : origin.x <= x) return false
  const top = { x, y: options.top - SAFE_AREA_SLACK }
  const bottom = { x, y: options.bottom + SAFE_AREA_SLACK }
  const sides = [
    cross(origin, top, point),
    cross(top, bottom, point),
    cross(bottom, origin, point),
  ]
  return sides.every((side) => side >= 0) || sides.every((side) => side <= 0)
}

// How close to the end of the options the next page is asked for.
const END_THRESHOLD = 48

const isNearEnd = (list: HTMLElement | null) =>
  list !== null &&
  list.scrollHeight - list.scrollTop - list.clientHeight < END_THRESHOLD

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
  // Options that load page by page ask for the next one when the list is
  // scrolled near its end. It is measured, not observed, so a page that has
  // just arrived is not mistaken for an end that is still in view.
  const listRef = useRef<HTMLDivElement>(null)
  const { onEndReached, loadingMore = false, loadMoreFailed = false } = filter
  // A page that failed is only asked for again from the retry row.
  const isWaiting = loadingMore || loadMoreFailed
  const loadMoreAtEnd = () => {
    if (!isWaiting && isNearEnd(listRef.current)) onEndReached?.()
  }
  // A page can be too short to fill the list, which leaves nothing to scroll,
  // so the end is also checked whenever the options change.
  const optionCount = filter.options.length
  useEffect(() => {
    if (!isWaiting && isNearEnd(listRef.current)) onEndReached?.()
  }, [optionCount, isWaiting, onEndReached])

  const isSelectable = filter.type === 'multi' || filter.selectable !== false

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
    <div className={twMerge(PANEL_CLASS, filter.extra ? 'w-max' : 'w-64')}>
      {filter.searchPlaceholder && (
        <input
          autoFocus
          className={SEARCH_CLASS}
          placeholder={filter.searchPlaceholder}
          aria-label={`Filter ${filter.label.toLowerCase()} options`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Selected options are pinned first, so a multi-select takes the
            // first one that is not yet picked.
            const first =
              filter.type === 'multi'
                ? options.find((option) => !isSelected(filter, option))
                : options[0]
            if (event.key === 'Enter' && first) pick(first)
          }}
        />
      )}
      <div
        ref={listRef}
        className="max-h-72 overflow-y-auto p-1.5"
        onScroll={loadMoreAtEnd}
      >
        {options.length === 0 && !filter.extra && (
          <div className={EMPTY_CLASS}>
            {filter.loading
              ? 'Loading...'
              : (filter.emptyLabel ?? 'No matches')}
          </div>
        )}
        {options.map((option) => {
          const isOn = isSelected(filter, option)
          return (
            <button
              key={option.value}
              type="button"
              role={
                !isSelectable
                  ? 'menuitem'
                  : filter.type === 'multi'
                    ? 'menuitemcheckbox'
                    : 'menuitemradio'
              }
              aria-checked={isSelectable ? isOn : undefined}
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
                isSelectable && (
                  <span className="flex size-3.5 shrink-0 items-center">
                    {isOn && <Check className="size-3.5" />}
                  </span>
                )
              )}
              {option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
        {loadingMore && <div className={EMPTY_CLASS}>Loading...</div>}
        {loadMoreFailed && !loadingMore && (
          <button
            type="button"
            className={twMerge(ITEM_CLASS, ITEM_HOVER_CLASS)}
            onClick={() => onEndReached?.()}
          >
            <span className="dark:text-polar-500 text-gray-400">
              Could not load more.
            </span>
            Try again
          </button>
        )}
      </div>
      {filter.extra && (
        <div className="dark:border-polar-700 border-t border-gray-200">
          {filter.extra}
        </div>
      )}
    </div>
  )
}

interface ToolbarFilterMenuProps {
  filters: Filter[]
  // Offered at the foot of the menu while there is something to reset.
  onReset?: () => void
  // The toolbar button, a plus that follows the filter chips, or an arrow
  // inside a line of text. The plus sits at the left of the toolbar, so its
  // menu and options open to the right. The arrow can be anywhere, so its
  // options open towards the middle of the window.
  variant?: 'toolbar' | 'add' | 'inline'
  // Things to do, listed above the properties.
  actions?: ToolbarAction[]
}

// A list of properties, each opening its options beside it.
export const ToolbarFilterMenu = ({
  filters,
  onReset,
  variant = 'toolbar',
  actions = [],
}: ToolbarFilterMenuProps) => {
  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const isAdd = variant === 'add'
  const isInline = variant === 'inline'
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isInLeftHalf, setIsInLeftHalf] = useState(false)
  const opensRight = isAdd || (isInline && isInLeftHalf)
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
  const optionsRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<Point[]>([])
  const openedAtRef = useRef(0)
  const pendingRef = useRef<{
    key: string | null
    timer: ReturnType<typeof setTimeout>
  } | null>(null)
  const clearPending = () => {
    clearTimeout(pendingRef.current?.timer)
    pendingRef.current = null
  }
  useEffect(() => () => clearTimeout(pendingRef.current?.timer), [])

  // Moving diagonally from a property to its options crosses the properties
  // below it. Those do not take over while the pointer is heading for the
  // options, unless it lingers on one of them.
  const hover = (key: string | null, event: MouseEvent) => {
    const point = { x: event.clientX, y: event.clientY }
    const trail = trailRef.current
    const origin = getOrigin(trail, point)
    trailRef.current = [...trail.slice(1 - TRAIL_LENGTH), point]
    if (key === activeKey) {
      clearPending()
      return
    }
    const open = (next: string | null) => {
      openedAtRef.current = event.timeStamp
      activate(next)
    }
    const options = optionsRef.current
    if (
      options &&
      origin &&
      event.timeStamp - openedAtRef.current >= SETTLE_DELAY &&
      isHeadingForOptions(
        point,
        origin,
        options.getBoundingClientRect(),
        opensRight,
      )
    ) {
      if (pendingRef.current?.key === key) return
      clearPending()
      pendingRef.current = {
        key,
        timer: setTimeout(() => {
          pendingRef.current = null
          open(key)
        }, LINGER_DELAY),
      }
      return
    }
    clearPending()
    open(key)
  }
  const onOpenChange = (value: boolean) => {
    clearPending()
    trailRef.current = []
    const trigger = triggerRef.current?.getBoundingClientRect()
    if (value && trigger) {
      setIsInLeftHalf(trigger.left < window.innerWidth / 2)
    }
    setOpen(value)
    activate(null)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {isInline ? (
          <button
            ref={triggerRef}
            type="button"
            className={INLINE_TRIGGER_CLASS}
            aria-label="More actions"
          >
            <ChevronDown className="size-3" aria-hidden />
          </button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className={twMerge(
              isAdd ? ADD_TRIGGER_CLASS : 'h-7 w-7 [&_svg]:size-4!',
              (open || (hasApplied && !isAdd)) && TRIGGER_ON_CLASS,
            )}
            aria-label={
              isAdd
                ? 'Add filter'
                : hasApplied
                  ? 'Filters, some applied'
                  : 'Filters'
            }
            title={isAdd ? 'Add filter' : 'Filters'}
          >
            {isAdd ? <Plus /> : <FilterListOutlined fontSize="inherit" />}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={isAdd || isInline ? 'start' : 'end'}
        sideOffset={8}
        className={twMerge(PANEL_CLASS, 'w-60 overflow-visible p-0')}
      >
        {actions.length > 0 && (
          <div
            className={twMerge(
              'p-1.5',
              filters.length > 0 &&
                'dark:border-polar-700 border-b border-gray-200',
            )}
            onMouseMove={(event) => hover(null, event)}
          >
            {actions.map(({ key, label, icon, onSelect }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                className={twMerge(ITEM_CLASS, ITEM_HOVER_CLASS)}
                onClick={() => {
                  onSelect()
                  onOpenChange(false)
                }}
              >
                <span className={ICON_CLASS}>{icon}</span>
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        )}
        {filters.length > 0 && (
          <div className="p-1.5">
            {filters.map((filter) => {
              const isActive = filter.key === activeKey
              return (
                <div
                  key={filter.key}
                  className="relative"
                  onMouseMove={(event) => hover(filter.key, event)}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isActive}
                    className={twMerge(
                      ITEM_CLASS,
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
                    <div
                      ref={optionsRef}
                      className={twMerge(
                        'absolute top-0 -mt-[7px]',
                        opensRight ? 'left-full pl-3' : 'right-full pr-3',
                      )}
                    >
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
        )}
        {onReset && (
          <div
            className="dark:border-polar-700 border-t border-gray-200 p-1.5"
            onMouseMove={(event) => hover(null, event)}
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
