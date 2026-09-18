'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
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
import { VoidConfigSignal } from './api'
import { useVoidSignals } from './signalQueries'
import { withKeptParams } from './searchParams'
import { SIGNAL_KIND, signalHref } from './signals'

const FILTERS = ['all', 'meter', 'semantic'] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  meter: 'Meter',
  semantic: 'Semantic',
}

const matches = (signal: VoidConfigSignal, filter: Filter) =>
  filter === 'all' || signal.kind === filter

export const VoidSignalListSidebar = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const listBase = `${base}/definition/signals`
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const withQuerystring = withKeptParams(searchParams, ['query', 'filter'])
  const selectedSlug = pathname.startsWith(`${listBase}/`)
    ? decodeURIComponent(pathname.slice(listBase.length + 1))
    : null

  const [query, setQuery] = useQueryState('query', parseAsString)
  const [filter, setFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(FILTERS).withDefault('all'),
  )

  const { signals, loading, error } = useVoidSignals()
  const needle = (query ?? '').trim().toLowerCase()
  const visible = useMemo(
    () =>
      signals
        .filter((signal) => matches(signal, filter))
        .filter(
          (signal) =>
            !needle ||
            `${signal.slug} ${signal.meter}`.toLowerCase().includes(needle),
        ),
    [signals, filter, needle],
  )

  return (
    <Box flexDirection="column" height="100%">
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="xl"
        padding="l"
      >
        <Link href={withQuerystring(listBase)}>Signals</Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-6 w-6" variant="ghost">
              <FilterList fontSize="small" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {FILTERS.map((option) => (
              <DropdownMenuItem key={option} onClick={() => setFilter(option)}>
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
          placeholder="Search signals"
          value={query ?? ''}
          onChange={(event) => setQuery(event.target.value || null)}
        />
      </Box>
      <Box flexDirection="column" flexGrow={1} overflowY="auto">
        {loading ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              Loading signals
            </Text>
          </Box>
        ) : error ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              {error.message}
            </Text>
          </Box>
        ) : (
          <>
            {visible.map((signal) => (
              <Link
                key={signal.slug}
                href={withQuerystring(signalHref(base, signal.slug))}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedSlug === signal.slug &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <Box
                  flexDirection="column"
                  minWidth={0}
                  paddingHorizontal="l"
                  paddingVertical="m"
                  rowGap="xs"
                >
                  <Text truncate>{signal.slug}</Text>
                  <Text truncate color="muted" variant="caption">
                    {SIGNAL_KIND[signal.kind].label} · {signal.meter}
                  </Text>
                </Box>
              </Link>
            ))}
            {visible.length === 0 ? (
              <Box padding="l">
                <Text color="muted" variant="caption">
                  {needle || filter !== 'all' ? 'No signals match' : 'No signals'}
                </Text>
              </Box>
            ) : null}
          </>
        )}
      </Box>
    </Box>
  )
}
