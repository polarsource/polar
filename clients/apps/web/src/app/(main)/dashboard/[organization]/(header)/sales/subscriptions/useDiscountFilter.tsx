import { type Filter } from '@/components/Shared/FilterPopover'
import { useDiscountsByIds, useInfiniteDiscounts } from '@/hooks/queries'
import { useDebouncedCallback } from '@/hooks/utils'
import { schemas } from '@polar-sh/client'
import { TicketPercent } from '@polar-sh/orbit/icons'
import { useState } from 'react'
import { uniqueOptions } from '@/components/Shared/Toolbar/filterOptions'

const SEARCH_DELAY = 200
const PAGE_SIZE = 50

const toOption = ({ id, name }: schemas['Discount']) => ({
  value: id,
  label: name,
})

// Discounts are searched on the server and load page by page. The selected
// ones are fetched on their own and stay at the top, so they keep their names
// whatever the search shows.
export const useDiscountFilter = (
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
  } = useInfiniteDiscounts(organizationId, {
    query: search || undefined,
    limit: PAGE_SIZE,
  })
  const selected = useDiscountsByIds(organizationId, value ?? []).flatMap(
    (result) => (result.data ? [toOption(result.data)] : []),
  )
  const found = (data?.pages ?? []).flatMap((page) => page.items.map(toOption))

  return {
    key: 'discount',
    label: 'Discount',
    icon: <TicketPercent className="size-4" />,
    type: 'multi',
    options: uniqueOptions([...selected, ...found]),
    value: value ?? [],
    onChange: (next) => onChange(next.length > 0 ? next : null),
    searchPlaceholder: 'Search discounts...',
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
