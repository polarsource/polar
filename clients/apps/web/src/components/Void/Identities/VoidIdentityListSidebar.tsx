'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import FilterList from '@mui/icons-material/FilterList'
import Search from '@mui/icons-material/Search'
import { Avatar, Button, Input, Text } from '@polar-sh/orbit'
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
import { buildTree } from '../identities'
import { getVoidData } from '../mock'
import { VoidIdentity } from '../types'

const FILTERS = ['all', 'customer', 'human', 'agent', 'service'] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  customer: 'Customers',
  human: 'Humans',
  agent: 'Agents',
  service: 'Services',
}

const matches = (identity: VoidIdentity, filter: Filter) =>
  filter === 'all' ||
  (filter === 'customer'
    ? identity.parent_id === null
    : identity.kind === filter)

export const VoidIdentityListSidebar = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}/identities`
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
  const selectedId = pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1).split('/')[0]
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

  const data = useMemo(() => getVoidData(), [])
  const tree = useMemo(() => buildTree(data.identities), [data])
  const needle = (query ?? '').trim().toLowerCase()

  const identities = useMemo(
    () =>
      data.identities
        .filter((identity) => matches(identity, filter))
        .filter(
          (identity) =>
            !needle ||
            `${identity.name} ${identity.kind}`.toLowerCase().includes(needle),
        )
        .sort((a, b) => {
          const diff =
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          return sorting === 'newest' ? diff : -diff
        }),
    [data, filter, needle, sorting],
  )

  const secondary = (identity: VoidIdentity) => {
    const parent = identity.parent_id
      ? tree.byId.get(identity.parent_id)?.identity.name
      : null
    return parent ? `${identity.kind} · ${parent}` : identity.kind
  }

  return (
    <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
      <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
        <Link href={withQuerystring(base)}>Identities</Link>
        <div className="flex flex-row items-center gap-4">
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
        </div>
      </div>
      <div className="flex flex-row items-center gap-3 px-4 py-2">
        <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
          <Search
            fontSize="inherit"
            className="dark:text-polar-500 text-gray-500"
          />
        </div>
        <Input
          className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          placeholder="Search identities"
          value={query ?? ''}
          onChange={(event) => setQuery(event.target.value || null)}
        />
      </div>
      <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
        {identities.map((identity) => (
          <Link
            key={identity.id}
            href={withQuerystring(`${base}/${identity.id}`)}
            className={twMerge(
              'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
              selectedId === identity.id && 'dark:bg-polar-800 bg-gray-100',
            )}
          >
            <Box
              alignItems="center"
              columnGap="m"
              paddingHorizontal="l"
              paddingVertical="m"
            >
              <Avatar
                className="h-8 w-8"
                avatar_url={null}
                name={identity.name}
              />
              <Box flexDirection="column" minWidth={0}>
                <Text truncate>{identity.name}</Text>
                <Text truncate color="muted" variant="caption">
                  {secondary(identity)}
                </Text>
              </Box>
            </Box>
          </Link>
        ))}
        {identities.length === 0 ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              No identities match
            </Text>
          </Box>
        ) : null}
      </div>
    </div>
  )
}
