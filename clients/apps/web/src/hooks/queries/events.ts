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

export interface PropertyGroupStat {
  value: string
  occurrences: number
  customers: number
  totals: Record<string, string>
}

export const useEventPropertyGroupStats = (
  organizationId: string,
  property: string,
  parameters: Omit<
    NonNullable<
      operations['events:get_statistics_by_property']['parameters']['query']
    >,
    'organization_id' | 'timezone' | 'property'
  >,
  enabled: boolean = true,
) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as operations['events:get_statistics_by_property']['parameters']['query']['timezone']
  return useQuery({
    queryKey: [
      'eventPropertyGroupStats',
      organizationId,
      property,
      { timezone, ...parameters },
    ],
    queryFn: (): Promise<{ items: PropertyGroupStat[] }> =>
      unwrap(
        api.GET('/v1/events/statistics/by-property', {
          params: {
            query: {
              organization_id: organizationId,
              property,
              timezone,
              ...parameters,
            },
          },
        }),
      ) as unknown as Promise<{ items: PropertyGroupStat[] }>,
    retry: defaultRetry,
    enabled,
  })
}

export interface CustomerStatItem {
  customer_id: string | null
  external_customer_id: string | null
  name: string | null
  email: string | null
  occurrences: number
  totals: Record<string, string>
  share: number
}

export interface VarianceStatItem {
  event_id: string
  name: string
  customer_id: string | null
  external_customer_id: string | null
  timestamp: string
  values: Record<string, string>
  averages: Record<string, string>
  p99: Record<string, string>
}

export const useEventCustomerStats = (
  organizationId: string,
  parameters: {
    start_date: string
    end_date: string
    aggregate_fields?: string[]
    customer_id?: string[] | null
    limit?: number
  },
  enabled: boolean = true,
) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as operations['events:get_statistics_by_property']['parameters']['query']['timezone']
  return useQuery({
    queryKey: [
      'eventCustomerStats',
      organizationId,
      { timezone, ...parameters },
    ],
    queryFn: (): Promise<{ items: CustomerStatItem[] }> =>
      unwrap(
        // @ts-expect-error by-customer isn't in the generated schema while in beta
        api.GET('/v1/events/statistics/by-customer', {
          params: {
            query: { organization_id: organizationId, timezone, ...parameters },
          },
        }),
      ) as unknown as Promise<{ items: CustomerStatItem[] }>,
    retry: defaultRetry,
    enabled,
  })
}

export const useEventVarianceStats = (
  organizationId: string,
  parameters: {
    start_date: string
    end_date: string
    aggregate_fields?: string[]
    customer_id?: string[] | null
  },
  enabled: boolean = true,
) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as operations['events:get_statistics_by_property']['parameters']['query']['timezone']
  return useQuery({
    queryKey: [
      'eventVarianceStats',
      organizationId,
      { timezone, ...parameters },
    ],
    queryFn: (): Promise<{ items: VarianceStatItem[] }> =>
      unwrap(
        // @ts-expect-error by-variance isn't in the generated schema while in beta
        api.GET('/v1/events/statistics/by-variance', {
          params: {
            query: { organization_id: organizationId, timezone, ...parameters },
          },
        }),
      ) as unknown as Promise<{ items: VarianceStatItem[] }>,
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
