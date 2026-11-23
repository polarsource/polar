import { useDebouncedCallback } from '@/hooks/utils'
import { Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search, X } from '@polar-sh/orbit/icons'
import { useEffect, useRef, useState } from 'react'

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
  const [text, setText] = useState(value ?? '')

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

  const clear = () => {
    setText('')
    onChange(null)
    // Supersedes a commit still pending from typing.
    commit('')
    inputRef.current?.focus()
  }

  return (
    <Box position="relative" alignItems="center">
      <Input
        ref={inputRef}
        type="search"
        aria-label="Search"
        className="dark:focus:border-polar-600 h-8 w-56 rounded-full pr-8 pl-8.5 shadow-none focus:border-gray-300 focus:shadow-xs focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:appearance-none"
        preSlot={<Search className="size-3.5" />}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          commit(event.target.value)
        }}
      />
      {text && (
        <Box
          position="absolute"
          top={0}
          bottom={0}
          right="xs"
          alignItems="center"
          zIndex={20}
        >
          <button
            type="button"
            aria-label="Clear search"
            className="dark:text-polar-500 flex size-6 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:text-black dark:hover:text-white"
            onClick={clear}
          >
            <X className="size-3.5" />
          </button>
        </Box>
      )}
    </Box>
  )
}
