'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

export type SelectionPageState = 'none' | 'some' | 'all'

export interface Selection<T> {
  selected: T[]
  count: number
  isSelected: (item: T) => boolean
  toggle: (item: T, options?: { shiftKey?: boolean }) => void
  setPageSelected: (selected: boolean) => void
  pageState: SelectionPageState
  pageSelectedCount: number
  pageSize: number
  clear: () => void
}

export interface UseSelectionOptions<T> {
  items: T[]
  getId: (item: T) => string
  resetKey?: string
}

interface SelectionState<T> {
  map: ReadonlyMap<string, T>
  anchorId: string | null
}

const emptyState = <T>(): SelectionState<T> => ({
  map: new Map(),
  anchorId: null,
})

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

export function useSelection<T>({
  items,
  getId,
  resetKey,
}: UseSelectionOptions<T>): Selection<T> {
  const [state, setState] = useState(emptyState<T>)
  const ids = useMemo(() => items.map(getId), [items, getId])

  const [previousResetKey, setPreviousResetKey] = useState(resetKey)
  if (resetKey !== previousResetKey) {
    setPreviousResetKey(resetKey)
    setState(emptyState())
  }

  const latest = useRef({ items, ids, getId })
  latest.current = { items, ids, getId }

  const isSelected = useCallback(
    (item: T) => state.map.has(getId(item)),
    [state, getId],
  )

  const toggle = useCallback((item: T, options?: { shiftKey?: boolean }) => {
    const { items, ids, getId } = latest.current
    const id = getId(item)
    const index = ids.indexOf(id)

    setState((previous) => {
      const anchorIndex =
        previous.anchorId === null ? -1 : ids.indexOf(previous.anchorId)
      const isRange =
        Boolean(options?.shiftKey) && anchorIndex !== -1 && index !== -1
      const targets = isRange
        ? items.slice(
            Math.min(anchorIndex, index),
            Math.max(anchorIndex, index) + 1,
          )
        : [item]

      return {
        map: applySelection(
          previous.map,
          targets,
          !previous.map.has(id),
          getId,
        ),
        anchorId: isRange ? previous.anchorId : index === -1 ? null : id,
      }
    })
  }, [])

  const setPageSelected = useCallback((selected: boolean) => {
    const { items, getId } = latest.current
    setState((previous) => ({
      ...previous,
      map: applySelection(previous.map, items, selected, getId),
    }))
  }, [])

  const clear = useCallback(() => setState(emptyState()), [])

  const selected = useMemo(() => {
    const onPage = new Map(ids.map((id, index) => [id, items[index]]))
    return Array.from(state.map, ([id, item]) => onPage.get(id) ?? item)
  }, [state, items, ids])

  const pageSelectedCount = useMemo(() => {
    let selectedCount = 0
    for (const id of ids) {
      if (state.map.has(id)) {
        selectedCount++
      }
    }
    return selectedCount
  }, [ids, state])

  const pageState = useMemo((): SelectionPageState => {
    if (ids.length === 0 || pageSelectedCount === 0) {
      return 'none'
    }
    return pageSelectedCount === ids.length ? 'all' : 'some'
  }, [ids, pageSelectedCount])

  return useMemo(
    () => ({
      selected,
      count: selected.length,
      isSelected,
      toggle,
      setPageSelected,
      pageState,
      pageSelectedCount,
      pageSize: ids.length,
      clear,
    }),
    [
      selected,
      isSelected,
      toggle,
      setPageSelected,
      pageState,
      pageSelectedCount,
      ids,
      clear,
    ],
  )
}
