'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

export type SelectionPageState = 'none' | 'some' | 'all'

export interface Selection<T> {
  selected: T[]
  count: number
  isSelected: (item: T) => boolean
  /** Toggles a single item, or selects the range from the anchor with `shiftKey`. */
  toggle: (item: T, options?: { shiftKey?: boolean }) => void
  setPageSelected: (selected: boolean) => void
  pageState: SelectionPageState
  clear: () => void
}

export interface UseSelectionOptions<T> {
  /** The items currently rendered (the current page). */
  items: T[]
  /** Must be referentially stable — hoist to module scope or wrap in `useCallback`. */
  getId: (item: T) => string
}

const resolveToggleTargets = <T>(
  items: T[],
  getId: (item: T) => string,
  item: T,
  anchorId: string | null,
  shiftKey: boolean,
): { targets: T[]; isRange: boolean; nextAnchorId: string | null } => {
  const id = getId(item)
  const index = items.findIndex((candidate) => getId(candidate) === id)
  const anchorIndex =
    anchorId === null
      ? -1
      : items.findIndex((candidate) => getId(candidate) === anchorId)
  if (shiftKey && anchorIndex !== -1 && index !== -1) {
    const start = Math.min(anchorIndex, index)
    const end = Math.max(anchorIndex, index)
    return {
      targets: items.slice(start, end + 1),
      isRange: true,
      nextAnchorId: anchorId,
    }
  }
  return {
    targets: [item],
    isRange: false,
    nextAnchorId: index === -1 ? null : id,
  }
}

const applySelection = <T>(
  map: ReadonlyMap<string, T>,
  targets: T[],
  selected: boolean,
  getId: (item: T) => string,
): Map<string, T> => {
  const next = new Map(map)
  for (const target of targets) {
    if (selected) {
      next.set(getId(target), target)
    } else {
      next.delete(getId(target))
    }
  }
  return next
}

const derivePageState = <T>(
  items: T[],
  isSelected: (item: T) => boolean,
): SelectionPageState => {
  if (items.length === 0) {
    return 'none'
  }
  const selectedCount = items.filter(isSelected).length
  if (selectedCount === 0) {
    return 'none'
  }
  return selectedCount === items.length ? 'all' : 'some'
}

export function useSelection<T>({
  items,
  getId,
}: UseSelectionOptions<T>): Selection<T> {
  const [selectedMap, setSelectedMap] = useState<ReadonlyMap<string, T>>(
    () => new Map(),
  )
  const anchorRef = useRef<string | null>(null)

  const isSelected = useCallback(
    (item: T) => selectedMap.has(getId(item)),
    [selectedMap, getId],
  )

  const toggle = useCallback(
    (item: T, options?: { shiftKey?: boolean }) => {
      const { targets, isRange, nextAnchorId } = resolveToggleTargets(
        items,
        getId,
        item,
        anchorRef.current,
        options?.shiftKey ?? false,
      )
      const id = getId(item)
      setSelectedMap((previous) =>
        applySelection(previous, targets, isRange || !previous.has(id), getId),
      )
      anchorRef.current = nextAnchorId
    },
    [items, getId],
  )

  const setPageSelected = useCallback(
    (selected: boolean) => {
      setSelectedMap((previous) =>
        applySelection(previous, items, selected, getId),
      )
    },
    [items, getId],
  )

  const clear = useCallback(() => {
    setSelectedMap(new Map())
    anchorRef.current = null
  }, [])

  const selected = useMemo(
    () => Array.from(selectedMap.values()),
    [selectedMap],
  )

  const pageState = useMemo(
    () => derivePageState(items, isSelected),
    [items, isSelected],
  )

  return useMemo(
    () => ({
      selected,
      count: selected.length,
      isSelected,
      toggle,
      setPageSelected,
      pageState,
      clear,
    }),
    [selected, isSelected, toggle, setPageSelected, pageState, clear],
  )
}
