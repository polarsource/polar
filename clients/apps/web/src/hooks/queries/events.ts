import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useInfiniteEvents = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['events:list']['parameters']['query']>,
    'organization_id' | 'page'
  >,
  enabled: boolean = true,
) => {
  return useInfiniteQuery({
    queryKey: ['events', 'infinite', { organizationId, ...(parameters || {}) }],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/events/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
              page: pageParam,
            },
          },
        }),
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const pagination = lastPage.pagination
      if (lastPage.items.length === 0) {
        return null
      }
      if ('max_page' in pagination && lastPageParam === pagination.max_page) {
        return null
      }
      if ('has_next_page' in pagination && !pagination.has_next_page) {
        return null
      }

      return lastPageParam + 1
    },
    retry: defaultRetry,
    enabled,
  })
}

export const useEvents = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['events:list']['parameters']['query']>,
    'organization_id'
  >,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ['events', organizationId, { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
    retry: defaultRetry,
    enabled,
  })
}

export const isCursorPagination = (
  pagination:
    | { total_count: number; max_page: number }
    | { has_next_page: boolean },
): pagination is { has_next_page: boolean } => {
  return 'has_next_page' in pagination
}

export const useEvent = (
  organizationId: string,
  eventId: string,
  parameters?: { aggregate_fields?: string[] }, // This isn't added to the generated schema while in beta
) => {
  return useQuery({
    queryKey: ['event', organizationId, eventId, { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/{id}', {
          // @ts-expect-error aggregate_fields isn't in the generated schema while in beta
          params: { path: { id: eventId }, query: parameters },
        }),
      ),
    retry: defaultRetry,
    enabled: !!eventId,
  })
}

export const useEventHierarchyStats = (
  organizationId: string,
  parameters: Omit<
    NonNullable<
      operations['events:list_statistics_timeseries']['parameters']['query']
    >,
    'organization_id' | 'timezone'
  >,
  enabled: boolean = true,
) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as operations['events:list_statistics_timeseries']['parameters']['query']['timezone']
  return useQuery({
    queryKey: [
      'eventHierarchyStats',
      organizationId,
      { timezone, ...(parameters || {}) },
    ],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/statistics/timeseries', {
          params: {
            query: {
              organization_id: organizationId,
              timezone,
              ...(parameters || {}),
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled,
  })
}

export const useEventNames = (
  organizationId: string,
  parameters?: operations['event-types:list']['parameters']['query'],
) => {
  return useInfiniteQuery({
    queryKey: ['eventNames', organizationId, { ...(parameters || {}) }],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/event-types/', {
          params: {
            query: {
              organization_id: organizationId,
              ...(parameters || {}),
              page: pageParam,
            },
          },
        }),
      ),
    retry: defaultRetry,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (
        lastPageParam === lastPage.pagination.max_page ||
        lastPage.items.length === 0
      ) {
        return null
      }

      return lastPageParam + 1
    },
  })
}
