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
      if (
        lastPageParam === lastPage.pagination.max_page ||
        lastPage.items.length === 0
      ) {
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

export const useEvent = (organizationId: string, eventId: string) => {
  return useQuery({
    queryKey: ['event', organizationId, eventId],
    queryFn: () =>
      unwrap(api.GET('/v1/events/{id}', { params: { path: { id: eventId } } })),
    retry: defaultRetry,
    enabled: !!eventId,
  })
}

export const useEventHierarchyStats = (
  organizationId: string,
  startTimestamp: Date,
  endTimestamp: Date,
  interval: NonNullable<
    operations['events:list_statistics_timeseries']['parameters']['query']
  >['interval'],
  aggregateFields: string[] = ['cost.amount'],
  sorting?: operations['events:list_statistics_timeseries']['parameters']['query']['sorting'],
  eventTypeId?: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [
      'eventHierarchyStats',
      organizationId,
      {
        aggregate_fields: aggregateFields,
        sorting,
        startTimestamp,
        endTimestamp,
        interval,
        event_type_id: eventTypeId,
      },
    ],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/statistics/timeseries', {
          params: {
            query: {
              organization_id: organizationId,
              aggregate_fields: aggregateFields,
              start_timestamp: startTimestamp.toISOString(),
              end_timestamp: endTimestamp.toISOString(),
              interval,
              ...(sorting ? { sorting } : {}),
              ...(eventTypeId ? { event_type_id: eventTypeId } : {}),
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
  parameters?: operations['events:list_names']['parameters']['query'],
) => {
  return useInfiniteQuery({
    queryKey: ['eventNames', organizationId, { ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/names', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
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
