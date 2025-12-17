'use client'

import { useKeyboardNavigation } from '@/providers/KeyboardNavigationProvider'
import { useCallback, useEffect, useRef } from 'react'

interface UseListKeyboardNavigationOptions<T> {
  items: T[]
  onSelect?: (item: T, index: number) => void
  onOpen?: (item: T, index: number) => void
  getItemId: (item: T) => string
  itemSelector?: string
}

export function useListKeyboardNavigation<T>({
  items,
  onSelect,
  onOpen,
  getItemId,
  itemSelector = '[data-list-item]',
}: UseListKeyboardNavigationOptions<T>) {
  const { selectedIndex, setSelectedIndex, clearSelection } =
    useKeyboardNavigation()
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToItem = useCallback(
    (index: number) => {
      if (!containerRef.current) return

      const itemElements = containerRef.current.querySelectorAll(itemSelector)
      const targetElement = itemElements[index] as HTMLElement

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }
    },
    [itemSelector],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Ignore if command palette is open or modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault()
          const nextIndex = Math.min(selectedIndex + 1, items.length - 1)
          setSelectedIndex(nextIndex)
          scrollToItem(nextIndex)
          if (items[nextIndex]) {
            onSelect?.(items[nextIndex], nextIndex)
          }
          break
        }

        case 'ArrowUp':
        case 'k': {
          e.preventDefault()
          const prevIndex = Math.max(selectedIndex - 1, 0)
          setSelectedIndex(prevIndex)
          scrollToItem(prevIndex)
          if (items[prevIndex]) {
            onSelect?.(items[prevIndex], prevIndex)
          }
          break
        }

        case 'Enter': {
          if (selectedIndex >= 0 && items[selectedIndex]) {
            e.preventDefault()
            onOpen?.(items[selectedIndex], selectedIndex)
          }
          break
        }

        case 'Escape': {
          clearSelection()
          break
        }
      }
    },
    [
      items,
      selectedIndex,
      setSelectedIndex,
      scrollToItem,
      onSelect,
      onOpen,
      clearSelection,
    ],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selection when items change
  useEffect(() => {
    clearSelection()
  }, [items.length, clearSelection])

  return {
    containerRef,
    selectedIndex,
    setSelectedIndex,
    isSelected: (index: number) => selectedIndex === index,
    getItemProps: (index: number) => ({
      'data-list-item': true,
      'data-selected': selectedIndex === index,
    }),
  }
}
