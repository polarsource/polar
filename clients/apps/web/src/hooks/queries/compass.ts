import { api } from '@/utils/client'
import { paths, unwrap } from '@polar-sh/client'
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

type CompassTimezone = NonNullable<
  paths['/v1/compass/insights']['get']['parameters']['query']
>['timezone']

export const useCompassInsights = (organizationId: string, enabled = true) => {
  // The runtime value is always a valid IANA name; the generated param type
  // is a literal union the DOM API can't express. Part of the cache key: the
  // response varies by timezone, so a timezone change must not serve stale
  // insights.
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as CompassTimezone
  return useQuery({
    queryKey: ['compass_insights', { organizationId, timezone }],
    enabled,
    queryFn: () =>
      unwrap(
        api.GET('/v1/compass/insights', {
          params: {
            query: {
              organization_id: organizationId,
              timezone,
            },
          },
        }),
      ),
    retry: defaultRetry,
  })
}

export const useCompassThreads = (organizationId: string, enabled = true) => {
  return useQuery({
    queryKey: ['compass_threads', { organizationId }],
    enabled,
    queryFn: () =>
      unwrap(
        api.GET('/v1/compass/threads', {
          params: { query: { organization_id: organizationId, limit: 50 } },
        }),
      ),
    retry: defaultRetry,
  })
}

// Imperative: a mounted query would re-hydrate on focus and clobber a live conversation.
export const fetchCompassThread = (
  queryClient: QueryClient,
  threadId: string,
) =>
  queryClient.fetchQuery({
    queryKey: ['compass_threads', 'detail', threadId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/compass/threads/{id}', {
          params: { path: { id: threadId } },
        }),
      ),
    staleTime: 0,
  })

export const useDeleteCompassThread = (organizationId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (threadId: string) =>
      api.DELETE('/v1/compass/threads/{id}', {
        params: { path: { id: threadId } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['compass_threads', { organizationId }],
      })
    },
  })
}
