import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { defaultRetry } from './retry'

/**
 * List members for a customer with pagination support.
 */
export const useMembers = (
  customerId: string,
  parameters?: Omit<
    NonNullable<operations['members:list_members']['parameters']['query']>,
    'customer_id'
  >,
) =>
  useInfiniteQuery({
    queryKey: ['members', customerId, parameters],
    queryFn: async ({ pageParam }) =>
      unwrap(
        api.GET('/v1/members/', {
          params: {
            query: {
              customer_id: customerId,
              ...parameters,
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
    enabled: !!customerId,
  })

/**
 * Update a member by ID.
 */
export const useUpdateMember = (memberId: string, customerId: string) =>
  useMutation({
    mutationFn: (body: schemas['MemberUpdate']) =>
      api.PATCH('/v1/members/{id}', {
        params: { path: { id: memberId } },
        body,
      }),
    onSuccess: async () => {
      getQueryClient().invalidateQueries({
        queryKey: ['members', customerId],
      })
    },
  })
