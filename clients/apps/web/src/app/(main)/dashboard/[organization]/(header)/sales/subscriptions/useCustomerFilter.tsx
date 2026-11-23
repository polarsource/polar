import { type Filter } from '@/components/Shared/FilterPopover'
import { useCustomers, useCustomersByIds } from '@/hooks/queries'
import { useDebouncedCallback } from '@/hooks/utils'
import { schemas } from '@polar-sh/client'
import { User } from '@polar-sh/orbit/icons'
import { useState } from 'react'
import { uniqueOptions } from './filterOptions'

const SEARCH_DELAY = 200
const PAGE_SIZE = 50

const toOption = ({ id, name, email }: schemas['Customer']) => ({
  value: id,
  label: name || email || id,
})

// Customers are searched on the server and load page by page, since there can
// be too many to list.
// The selected ones are fetched on their own and stay at the top, so they keep
// their names whatever the search shows.
export const useCustomerFilter = (
  organizationId: string,
  value: string[] | null,
  onChange: (value: string[] | null) => void,
): Filter => {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const commitSearch = useDebouncedCallback(setSearch, SEARCH_DELAY)

  const {
    data,
    isLoading,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useCustomers(organizationId, {
    query: search || undefined,
    limit: PAGE_SIZE,
  })
  const selected = useCustomersByIds(value ?? []).flatMap((result) =>
    result.data ? [toOption(result.data)] : [],
  )
  const found = (data?.pages ?? []).flatMap((page) => page.items.map(toOption))

  return {
    key: 'customer',
    label: 'Customer',
    icon: <User className="size-4" />,
    type: 'multi',
    options: uniqueOptions([...selected, ...found]),
    value: value ?? [],
    onChange: (next) => onChange(next.length > 0 ? next : null),
    searchPlaceholder: 'Search customers...',
    searchQuery: query,
    onSearchQueryChange: (next) => {
      setQuery(next)
      commitSearch(next)
    },
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    loadMoreFailed: isFetchNextPageError,
    onEndReached: () => {
      if (hasNextPage && !isFetching) fetchNextPage()
    },
  }
}
