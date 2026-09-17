'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import FilterList from '@mui/icons-material/FilterList'
import Search from '@mui/icons-material/Search'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { useVoidDeploys } from './api'
import { useVoidDataSource } from './dataSource'
import { useVoidProducts } from './productQueries'
import {
  FIXTURE_PRODUCTS,
  formatProductPrice,
  priceKind,
  productHref,
  productsOfActive,
  VoidProduct,
} from './products'

const FILTERS = ['all', 'recurring', 'one_time'] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  recurring: 'Recurring',
  one_time: 'One-time',
}

const matches = (product: VoidProduct, filter: Filter) =>
  filter === 'all' || priceKind(product.price) === filter

export const VoidProductListSidebar = () => {
  const { organization } = useContext(OrganizationContext)
  const source = useVoidDataSource()
  const live = source === 'live'
  const base = `/void/dashboard/${organization.slug}`
  const listBase = `${base}/definition/products`
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const withQuerystring = (href: string) => {
    const kept = new URLSearchParams()
    for (const [key, value] of searchParams.entries()) {
      if (['query', 'filter', 'sorting'].includes(key)) kept.append(key, value)
    }
    const qs = kept.toString()
    return qs ? `${href}?${qs}` : href
  }
  const selectedId = pathname.startsWith(`${listBase}/`)
    ? pathname.slice(listBase.length + 1)
    : null

  const [query, setQuery] = useQueryState('query', parseAsString)
  const [filter, setFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(FILTERS).withDefault('all'),
  )
  const [sorting, setSorting] = useQueryState(
    'sorting',
    parseAsStringLiteral(['newest', 'oldest'] as const).withDefault('newest'),
  )

  const liveProducts = useVoidProducts(organization.id, { enabled: live })
  const deploys = useVoidDeploys(organization.id, { enabled: live })

  const products = useMemo(() => {
    if (!live) return FIXTURE_PRODUCTS
    return productsOfActive(liveProducts.data ?? [], deploys.data ?? [])
  }, [live, liveProducts.data, deploys.data])

  const needle = (query ?? '').trim().toLowerCase()
  const visible = useMemo(() => {
    const selected = liveProducts.data?.find(
      (product) => product.id === selectedId,
    )
    const listed =
      selected && !products.some((product) => product.id === selected.id)
        ? [selected, ...products]
        : products
    return listed
      .filter((product) => matches(product, filter))
      .filter(
        (product) =>
          !needle ||
          `${product.name} ${product.slug}`.toLowerCase().includes(needle),
      )
      .toSorted((a, b) => {
        const diff =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return sorting === 'newest' ? diff : -diff
      })
  }, [liveProducts.data, products, selectedId, filter, needle, sorting])

  const liveError = liveProducts.error
  const liveLoading = live && liveProducts.isLoading

  return (
    <Box flexDirection="column" height="100%">
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="xl"
        padding="l"
      >
        <Link href={withQuerystring(listBase)}>Products</Link>
        <Box alignItems="center" columnGap="s">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="h-6 w-6" variant="ghost">
                <FilterList fontSize="small" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {FILTERS.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => setFilter(option)}
                >
                  <CheckOutlined
                    className={twMerge(
                      'h-4 w-4',
                      filter !== option && 'invisible',
                    )}
                  />
                  <span>{FILTER_LABELS[option]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() =>
              setSorting(sorting === 'newest' ? 'oldest' : 'newest')
            }
          >
            {sorting === 'oldest' ? (
              <ArrowUpward fontSize="small" />
            ) : (
              <ArrowDownward fontSize="small" />
            )}
          </Button>
        </Box>
      </Box>
      <Box
        alignItems="center"
        columnGap="m"
        paddingHorizontal="l"
        paddingVertical="s"
        borderTopWidth={1}
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Search fontSize="inherit" />
        <Input
          className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          placeholder="Search products"
          value={query ?? ''}
          onChange={(event) => setQuery(event.target.value || null)}
        />
      </Box>
      <Box flexDirection="column" flexGrow={1} overflowY="auto">
        {liveLoading ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              Loading products
            </Text>
          </Box>
        ) : liveError ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              {liveError.message}
            </Text>
          </Box>
        ) : (
          <>
            {visible.map((product) => (
              <Link
                key={product.id}
                href={withQuerystring(productHref(base, product.id))}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedId === product.id && 'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <Box
                  flexDirection="column"
                  minWidth={0}
                  paddingHorizontal="l"
                  paddingVertical="m"
                  rowGap="xs"
                >
                  <Text truncate>{product.name}</Text>
                  <Text truncate color="muted" variant="caption">
                    {formatProductPrice(product.price)}
                  </Text>
                </Box>
              </Link>
            ))}
            {visible.length === 0 ? (
              <Box padding="l">
                <Text color="muted" variant="caption">
                  {live ? 'No products' : 'No products match'}
                </Text>
              </Box>
            ) : null}
          </>
        )}
      </Box>
    </Box>
  )
}
