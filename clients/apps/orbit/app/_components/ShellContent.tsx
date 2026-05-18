'use client'

import { Box } from '@polar-sh/orbit/Box'
import { useSearch } from './SearchContext'
import { SearchView } from './SearchView'

export const ShellContent = ({ children }: { children: React.ReactNode }) => {
  const { isOpen } = useSearch()
  return (
    <Box as="section" flex={1} paddingHorizontal="xl" paddingBottom="2xl">
      {isOpen ? <SearchView /> : children}
    </Box>
  )
}
