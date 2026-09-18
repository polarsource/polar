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
import { useCallback, useContext, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { withKeptParams } from '../searchParams'
import { useVoidDataSource } from '../dataSource'
import {
  autoExpandedIdentityIds,
  buildTree,
  identityHref,
  identityIdFromPath,
  IdentityListFilter,
  visibleIdentityForest,
} from '../identities'
import { composeIdentities, toLiveIdentity } from '../identityLive'
import { useVoidCustomers, useVoidIdentities } from '../identityQueries'
import { getVoidData } from '../mock'
import { VoidIdentitySidebarNode } from './VoidIdentitySidebarNode'

const FILTERS = ['all', 'customer', 'human', 'agent', 'service'] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  customer: 'Customers',
  human: 'Humans',
  agent: 'Agents',
  service: 'Services',
}

const LIVE_FILTERS: Filter[] = ['all', 'customer', 'agent', 'service']

export const VoidIdentityListSidebar = () => {
  const { organization } = useContext(OrganizationContext)
  const source = useVoidDataSource()
  const live = source === 'live'
  const root = `/void/dashboard/${organization.slug}`
  const base = `${root}/identities`
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const withQuerystring = withKeptParams(searchParams, [
    'query',
    'filter',
    'sorting',
  ])
  const selectedId = pathname.startsWith(`${base}/`)
    ? identityIdFromPath(pathname.slice(base.length + 1))
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
  const [opened, setOpened] = useState<Record<string, boolean>>({})

  const liveIdentities = useVoidIdentities(organization.id, { enabled: live })
  const liveCustomers = useVoidCustomers(organization.id, { enabled: live })

  const identities = useMemo(() => {
    if (!live) return getVoidData().identities.map(toLiveIdentity)
    if (!liveIdentities.data) return []
    return composeIdentities(liveIdentities.data, liveCustomers.data ?? [])
  }, [live, liveIdentities.data, liveCustomers.data])

  const tree = useMemo(() => buildTree(identities), [identities])
  const needle = (query ?? '').trim().toLowerCase()
  const filterOptions = live ? LIVE_FILTERS : FILTERS
  const expandVisibleBranches = Boolean(needle) || filter !== 'all'

  const forest = useMemo(
    () =>
      visibleIdentityForest(
        tree,
        filter as IdentityListFilter,
        needle,
        sorting,
      ),
    [tree, filter, needle, sorting],
  )

  const autoExpanded = useMemo(
    () =>
      autoExpandedIdentityIds(tree, selectedId, forest, expandVisibleBranches),
    [tree, selectedId, forest, expandVisibleBranches],
  )

  const expandedIds = useMemo(() => {
    const ids = new Set(autoExpanded)
    for (const [id, open] of Object.entries(opened)) {
      if (open) ids.add(id)
    }
    return ids
  }, [autoExpanded, opened])

  const hrefFor = useCallback(
    (id: string) => withQuerystring(identityHref(root, id)),
    [withQuerystring, root],
  )

  const toggleExpanded = useCallback((id: string) => {
    setOpened((current) => {
      if (current[id]) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: true }
    })
  }, [])

  const liveError = liveIdentities.error
  const liveLoading = live && liveIdentities.isLoading

  return (
    <Box flexDirection="column" height="100%" overflow="hidden">
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        paddingHorizontal="l"
        paddingVertical="l"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Link href={withQuerystring(base)}>Identities</Link>
        <Box alignItems="center" columnGap="l">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="h-6 w-6" variant="ghost">
                <FilterList fontSize="small" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {filterOptions.map((option) => (
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
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box
          height={32}
          width={32}
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          backgroundColor="background-secondary"
          flexShrink={0}
        >
          <Search
            fontSize="inherit"
            className="dark:text-polar-500 text-gray-500"
          />
        </Box>
        <Input
          className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          placeholder="Search identities"
          value={query ?? ''}
          onChange={(event) => setQuery(event.target.value || null)}
        />
      </Box>
      <Box flexDirection="column" flexGrow={1} overflowY="auto" minHeight={0}>
        {liveLoading ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              Loading identities
            </Text>
          </Box>
        ) : liveError ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              {liveError.message}
            </Text>
          </Box>
        ) : forest.length === 0 ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              {live ? 'No identities' : 'No identities match'}
            </Text>
          </Box>
        ) : (
          forest.map((node) => (
            <Box
              key={node.identity.id}
              flexDirection="column"
              borderBottomWidth={1}
              borderStyle="solid"
              borderColor="border-secondary"
            >
              <VoidIdentitySidebarNode
                node={node}
                selectedId={selectedId}
                hrefFor={hrefFor}
                expandedIds={expandedIds}
                onToggle={toggleExpanded}
              />
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}
