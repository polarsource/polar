import { useDebouncedCallback } from '@/hooks/utils'
import { Input } from '@polar-sh/orbit'
import { Search } from '@polar-sh/orbit/icons'
import { useEffect, useRef } from 'react'

const SEARCH_DELAY = 300

interface ToolbarSearchProps {
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
}

// Free text applied as the list's `query`. Each list endpoint decides what it matches.
export const ToolbarSearch = ({
  value,
  onChange,
  placeholder,
}: ToolbarSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  // "/" focuses the search, unless it is being typed into another field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const commit = useDebouncedCallback(
    (text: string) => onChange(text.trim() || null),
    SEARCH_DELAY,
  )

  return (
    <Input
      ref={inputRef}
      type="search"
      aria-label="Search"
      className="dark:focus:border-polar-600 h-8 w-56 rounded-full pl-8.5 focus:border-gray-300 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      preSlot={<Search className="size-3.5" />}
      placeholder={placeholder}
      defaultValue={value ?? ''}
      onChange={(event) => commit(event.target.value)}
    />
  )
}
