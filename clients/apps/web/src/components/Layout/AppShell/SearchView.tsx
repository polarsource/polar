'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearch } from './SearchContext'

type SearchResult = schemas['SearchResults']['results'][number]

const SECTION_LABEL: Record<SearchResult['type'], string> = {
  customer: 'Customers',
  subscription: 'Subscriptions',
  order: 'Orders',
  product: 'Products',
}

const SECTION_ORDER: SearchResult['type'][] = [
  'customer',
  'subscription',
  'order',
  'product',
]

export const SearchView = () => {
  const { organization } = useContext(OrganizationContext)
  const { close } = useSearch()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const trimmedQuery = deferredQuery.trim()
  const hasQuery = trimmedQuery !== ''

  const { data, isFetching } = useQuery({
    queryKey: ['shell-search', organization?.id, trimmedQuery],
    queryFn: () =>
      unwrap(
        api.GET('/search', {
          params: {
            query: {
              organization_id: organization!.id,
              query: trimmedQuery,
              limit: 8,
            },
          },
        }),
      ),
    enabled: hasQuery && Boolean(organization?.id),
  })

  const grouped = useMemo(() => {
    const buckets: Partial<Record<SearchResult['type'], SearchResult[]>> = {}
    for (const result of data?.results ?? []) {
      const bucket = buckets[result.type] ?? []
      bucket.push(result)
      buckets[result.type] = bucket
    }
    return buckets
  }, [data])

  const handleSelect = (result: SearchResult) => {
    if (!organization) return
    const slug = organization.slug
    let href: string | undefined
    switch (result.type) {
      case 'customer':
        href = `/dashboard/${slug}/customers/${result.id}`
        break
      case 'subscription':
        href = `/dashboard/${slug}/sales/subscriptions/${result.id}`
        break
      case 'order':
        href = `/dashboard/${slug}/sales/${result.id}`
        break
      case 'product':
        href = `/dashboard/${slug}/products/${result.id}`
        break
    }
    if (!href) return
    router.push(href)
    close()
    setQuery('')
  }

  const hasResults = SECTION_ORDER.some((t) => (grouped[t]?.length ?? 0) > 0)

  return (
    <Box display="flex" flexDirection="column" rowGap="2xl" paddingTop="m">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search customers, subscriptions, orders…"
        className="w-full border-0 bg-transparent p-0 text-[2rem] leading-tight text-inherit ring-0 outline-hidden focus:ring-0 focus:outline-hidden focus-visible:ring-0 focus-visible:outline-hidden"
      />

      {!hasQuery && (
        <Text variant="body" color="muted">
          Start typing to search.
        </Text>
      )}

      {hasQuery && !hasResults && !isFetching && (
        <Text variant="body" color="muted">
          No results for “{query}”.
        </Text>
      )}

      {SECTION_ORDER.map((type) => {
        const items = grouped[type]
        if (!items || items.length === 0) return null
        return (
          <Section key={type} title={SECTION_LABEL[type]}>
            {items.map((item) => (
              <ResultRow key={item.id} result={item} onSelect={handleSelect} />
            ))}
          </Section>
        )
      })}
    </Box>
  )
}

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <Box display="flex" flexDirection="column" rowGap="s">
    <Text variant="body" color="muted">
      {title}
    </Text>
    <Box display="flex" flexDirection="column" rowGap="xs">
      {children}
    </Box>
  </Box>
)

type ResultRowProps = {
  result: SearchResult
  onSelect: (result: SearchResult) => void
}

const ResultRow = ({ result, onSelect }: ResultRowProps) => {
  const { primary, secondary } = describeResult(result)
  return (
    <Box
      role="button"
      cursor="pointer"
      display="flex"
      alignItems="center"
      columnGap="m"
      padding="l"
      borderRadius="m"
      backgroundColor="background-card"
      onClick={() => onSelect(result)}
    >
      <Text variant="body" color="default">
        {primary}
      </Text>
      {secondary && (
        <Text variant="body" color="muted">
          {secondary}
        </Text>
      )}
    </Box>
  )
}

const describeResult = (
  result: SearchResult,
): { primary: string; secondary?: string } => {
  switch (result.type) {
    case 'customer':
      return { primary: result.name ?? result.email, secondary: result.email }
    case 'subscription':
      return {
        primary: result.product_name,
        secondary: result.customer_name ?? result.customer_email,
      }
    case 'order':
      return {
        primary: result.product_name,
        secondary: result.customer_name ?? result.customer_email,
      }
    case 'product':
      return {
        primary: result.name,
        secondary: result.description ?? undefined,
      }
  }
}
