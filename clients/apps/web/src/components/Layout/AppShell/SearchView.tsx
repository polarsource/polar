'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useRef, useState } from 'react'

// Placeholder SearchView — task #3 wires real customer/subscription/product
// queries through here. For now this just renders the autofocused input so
// the shell + Cmd+K behavior can be validated end-to-end.

export const SearchView = () => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <Box display="flex" flexDirection="column" rowGap="2xl" paddingTop="m">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        style={{
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: 'inherit',
          font: 'inherit',
          fontSize: '2rem',
          lineHeight: 1.2,
          width: '100%',
          padding: 0,
        }}
      />

      {query.trim() === '' ? (
        <Text variant="body" color="muted">
          Start typing to search…
        </Text>
      ) : (
        <Text variant="body" color="muted">
          Search results coming soon for “{query}”.
        </Text>
      )}
    </Box>
  )
}
