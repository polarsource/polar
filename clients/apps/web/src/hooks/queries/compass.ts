import { api } from '@/utils/client'
import { paths, schemas, unwrap } from '@polar-sh/client'
import {
  QueryClient,
  useInfiniteQuery,
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

const THREADS_PAGE_SIZE = 50

export const useCompassThreads = (organizationId: string, enabled = true) => {
  return useInfiniteQuery({
    queryKey: ['compass_threads', { organizationId }],
    enabled,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/compass/threads', {
          params: {
            query: {
              organization_id: organizationId,
              limit: THREADS_PAGE_SIZE,
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

const THREAD_MESSAGES_PAGE_SIZE = 50

export type CompassThreadDetail = schemas['CompassThreadSchema'] & {
  messages: schemas['CompassThreadMessageSchema'][]
}

/**
 * Imperative fetch of a thread and its most recent turns. Use for explicit
 * hydration (deep link, history pick). A mounted query would re-hydrate on
 * cache/focus updates and clobber a live conversation.
 *
 * Messages are their own paginated resource; this takes the first page, which
 * the API serves newest-first, so it's the tail of the conversation.
 */
export const fetchCompassThread = (
  queryClient: QueryClient,
  threadId: string,
): Promise<CompassThreadDetail> =>
  queryClient.fetchQuery({
    queryKey: ['compass_threads', 'detail', threadId],
    queryFn: async () => {
      const [thread, messages] = await Promise.all([
        unwrap(
          api.GET('/v1/compass/threads/{id}', {
            params: { path: { id: threadId } },
          }),
        ),
        unwrap(
          api.GET('/v1/compass/threads/{id}/messages', {
            params: {
              path: { id: threadId },
              query: { limit: THREAD_MESSAGES_PAGE_SIZE },
            },
          }),
        ),
      ])
      return { ...thread, messages: messages.items }
    },
    staleTime: 0,
  })

export const useDeleteCompassThread = (organizationId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (threadId: string) =>
      api.DELETE('/v1/compass/threads/{id}', {
        params: { path: { id: threadId } },
      }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['compass_threads', { organizationId }],
      })
    },
  })
}
