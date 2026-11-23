import { useDebouncedCallback } from '@/hooks/utils'
import { Input } from '@polar-sh/orbit'
import { SearchOutlined } from '@polar-sh/orbit/icons'
import { useEffect, useRef } from 'react'

const SEARCH_DELAY = 300

interface ToolbarSearchProps {
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
}

// Free text applied as the list's `query`. What it matches is up to each list
// endpoint, so the placeholder says.
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
      className="h-8 w-56 rounded-full"
      preSlot={<SearchOutlined className="size-4!" />}
      placeholder={placeholder}
      defaultValue={value ?? ''}
      onChange={(event) => commit(event.target.value)}
    />
  )
}
