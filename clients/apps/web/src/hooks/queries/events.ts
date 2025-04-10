import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useEvents = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['events:list']['parameters']['query']>,
    'organization_id' | 'page'
  >,
) => {
  return useInfiniteQuery({
    queryKey: ['events', { organizationId, ...(parameters || {}) }],
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
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPageParam === lastPage.pagination.max_page ? null : lastPageParam + 1,
    retry: defaultRetry,
  })
}

export const useEventNames = (
  organizationId: string,
  parameters?: operations['events:list_names']['parameters']['query'],
) => {
  return useQuery({
    queryKey: ['eventNames', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/events/names', {
          params: {
            query: { organization_id: organizationId, ...(parameters || {}) },
          },
        }),
      ),
  })
}
