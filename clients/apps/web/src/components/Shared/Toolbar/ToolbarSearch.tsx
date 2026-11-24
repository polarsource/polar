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

export const ToolbarSearch = ({
  value,
  onChange,
  placeholder,
}: ToolbarSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(value ?? '')
  const [focused, setFocused] = useState(false)

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
        className="dark:focus:border-polar-500 h-8 w-76 rounded-full pr-8 pl-8.5 shadow-none focus:border-gray-400 focus:shadow-xs focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:appearance-none"
        preSlot={<Search className="size-3.5" />}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          commit(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            // Stops the native search input from also clearing the text.
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <Box
        position="absolute"
        top={0}
        bottom={0}
        right="xs"
        alignItems="center"
        zIndex={20}
      >
        {text ? (
          <button
            type="button"
            aria-label="Clear search"
            className="dark:text-polar-500 flex size-6 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:text-black dark:hover:text-white"
            onClick={clear}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          !focused && (
            <Box as="span" aria-hidden pr="s" pointerEvents="none">
              <kbd className="dark:bg-polar-700 dark:text-polar-400 flex size-[18px] items-center justify-center rounded-[4px] bg-gray-100 font-mono text-[11px] leading-none text-gray-500">
                /
              </kbd>
            </Box>
          )
        )}
      </Box>
    </Box>
  )
}
