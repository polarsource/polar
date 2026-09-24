'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import Search from '@mui/icons-material/Search'
import { Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'
import { useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { useVoidReducerRows } from './reducerRows'
import {
  capitalize,
  describeAggregation,
  formatReducerTotal,
  reducerHref,
} from './reducers'
import { withKeptParams } from './searchParams'

export const VoidReducerListSidebar = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const listBase = `${base}/definition/reducers`
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const withQuerystring = withKeptParams(searchParams, ['query'])
  const selectedId = pathname.startsWith(`${listBase}/`)
    ? decodeURIComponent(pathname.slice(listBase.length + 1))
    : null

  const [query, setQuery] = useQueryState('query', parseAsString)
  const { rows, loading, error } = useVoidReducerRows()
  const needle = (query ?? '').trim().toLowerCase()
  const visible = useMemo(
    () =>
      rows.filter(
        ({ reducer }) =>
          !needle ||
          `${reducer.slug} ${describeAggregation(reducer.aggregation)}`
            .toLowerCase()
            .includes(needle),
      ),
    [needle, rows],
  )

  return (
    <Box flexDirection="column" height="100%">
      <Box padding="l">
        <Link href={withQuerystring(listBase)}>Reducers</Link>
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
          placeholder="Search reducers"
          value={query ?? ''}
          onChange={(event) => setQuery(event.target.value || null)}
        />
      </Box>
      <Box flexDirection="column" flexGrow={1} overflowY="auto">
        {loading ? (
          <Box padding="l">
            <Text color="muted" variant="caption">
              Loading reducers
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
            {visible.map(({ reducer, metric }) => (
              <Link
                key={reducer.id}
                href={withQuerystring(reducerHref(base, reducer.id))}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedId === reducer.id && 'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <Box
                  flexDirection="column"
                  minWidth={0}
                  paddingHorizontal="l"
                  paddingVertical="m"
                  rowGap="xs"
                >
                  <Text truncate>{reducer.slug}</Text>
                  <Text truncate color="muted" variant="caption">
                    {capitalize(describeAggregation(reducer.aggregation))} ·{' '}
                    {formatReducerTotal(metric?.total)}
                  </Text>
                </Box>
              </Link>
            ))}
            {visible.length === 0 ? (
              <Box padding="l">
                <Text color="muted" variant="caption">
                  {needle ? 'No reducers match' : 'No reducers'}
                </Text>
              </Box>
            ) : null}
          </>
        )}
      </Box>
    </Box>
  )
}
