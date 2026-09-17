'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Pagination from '@/components/Pagination/Pagination'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useSearchParams } from 'next/navigation'
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs'
import { useCallback, useContext, useMemo } from 'react'
import { useVoidDataSource } from './dataSource'
import { useVoidEventNames, useVoidEvents } from './eventQueries'
import {
  eventTypeStats,
  filterFixtureEvents,
  FIXTURE_EVENTS,
  pageOf,
  toCatalogEvent,
  VoidCatalogEvent,
} from './events'
import { composeIdentities } from './identityLive'
import { useVoidCustomers, useVoidIdentities } from './identityQueries'
import { getVoidData } from './mock'
import { VoidEvents } from './VoidEvents'
import { VoidEventsFilters } from './VoidEventsFilters'

export const PAGE_SIZE = 25

export const VoidEventsPage = () => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const base = `/void/dashboard/${organization.slug}`
  const searchParams = useSearchParams()
  const [query, setQuery] = useQueryState('query', parseAsString)
  const [identity, setIdentity] = useQueryState('identity', parseAsString)
  const [selectedName, setSelectedName] = useQueryState('name', parseAsString)
  const [currentPage, setCurrentPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1),
  )

  const resetPage = useCallback(() => setCurrentPage(1), [setCurrentPage])
  const onQuery = useCallback(
    (value: string | null) => {
      setQuery(value)
      resetPage()
    },
    [resetPage, setQuery],
  )
  const onIdentity = useCallback(
    (value: string | null) => {
      setIdentity(value)
      resetPage()
    },
    [resetPage, setIdentity],
  )
  const onSelectName = useCallback(
    (name: string | null) => {
      setSelectedName(name)
      resetPage()
    },
    [resetPage, setSelectedName],
  )
  const onReset = useCallback(() => {
    setQuery(null)
    setIdentity(null)
    setSelectedName(null)
    setCurrentPage(1)
  }, [setCurrentPage, setIdentity, setQuery, setSelectedName])

  const identitiesQuery = useVoidIdentities(organization.id, { enabled: live })
  const customersQuery = useVoidCustomers(organization.id, { enabled: live })
  const eventsQuery = useVoidEvents(
    organization.id,
    {
      page: currentPage,
      limit: PAGE_SIZE,
      name: selectedName ?? undefined,
      external_identity_id: identity ?? undefined,
    },
    { enabled: live },
  )
  const namesQuery = useVoidEventNames(organization.id, identity ?? undefined, {
    enabled: live,
  })

  const identityNames = useMemo(() => {
    if (!live) {
      return new Map(
        getVoidData().identities.map((item) => [item.id, item.name]),
      )
    }
    return new Map(
      composeIdentities(
        identitiesQuery.data ?? [],
        customersQuery.data ?? [],
      ).map((item) => [item.id, item.name]),
    )
  }, [customersQuery.data, identitiesQuery.data, live])

  const fixtureItems = useMemo(() => {
    if (live) return []
    return filterFixtureEvents(FIXTURE_EVENTS, {
      name: selectedName,
      identity,
      query,
      identityNames,
    })
  }, [identity, identityNames, live, query, selectedName])

  const events: VoidCatalogEvent[] = live
    ? (eventsQuery.data?.items ?? []).map(toCatalogEvent)
    : pageOf(fixtureItems, currentPage, PAGE_SIZE)
  const totalCount = live
    ? (eventsQuery.data?.pagination.total_count ?? 0)
    : fixtureItems.length
  const types = live
    ? eventTypeStats((namesQuery.data?.items ?? []).map(toCatalogEvent))
    : eventTypeStats(
        filterFixtureEvents(FIXTURE_EVENTS, { identity, identityNames }),
      )

  const loading = live && eventsQuery.isLoading
  const error = live ? eventsQuery.error : null
  const empty = !loading && !error && events.length === 0

  return (
    <DashboardBody
      title="Events"
      header={
        <Text color="muted" variant="heading-xs">
          {totalCount.toLocaleString('en-US')}{' '}
          {totalCount === 1 ? 'Event' : 'Events'}
        </Text>
      }
      contextViewPlacement="left"
      contextViewTitle="Events"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <VoidEventsFilters
          query={query}
          onQuery={onQuery}
          identity={identity}
          onIdentity={onIdentity}
          selectedName={selectedName}
          onSelectName={onSelectName}
          types={types}
          onReset={onReset}
        />
      }
      wide
    >
      {loading ? (
        <Box height={128} borderRadius="m" backgroundColor="background-card" />
      ) : error ? (
        <Box
          borderRadius="m"
          backgroundColor="background-warning"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-warning"
          padding="l"
        >
          <Text>{error.message}</Text>
        </Box>
      ) : empty ? (
        <Box
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          paddingVertical="3xl"
          rowGap="l"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="xl"
        >
          <Text variant="heading-xs">No Events Found</Text>
          <Text color="muted">
            There are no events matching your current filters
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" rowGap="l">
          <VoidEvents
            events={events}
            base={base}
            identityNames={identityNames}
          />
          <Pagination
            className="self-end"
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            currentURL={searchParams}
          />
        </Box>
      )}
    </DashboardBody>
  )
}
