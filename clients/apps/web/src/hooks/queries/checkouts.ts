import { getServerURL } from '@/utils/api'
import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

// Rows can shift between pages while they load, so one can come back twice.
export const uniqueCheckouts = (
  pages: schemas['ListResource_Checkout_'][],
): schemas['Checkout'][] => [
  ...new Map(
    pages.flatMap((page) => page.items.map((item) => [item.id, item])),
  ).values(),
]

export const useInfiniteCheckouts = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['checkouts:list']['parameters']['query']>,
    'organization_id' | 'page'
  >,
) =>
  useInfiniteQuery({
    queryKey: ['checkouts', organizationId, 'infinite', parameters ?? {}],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/checkouts/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
              page: pageParam,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.items.length === 0 ||
      lastPageParam >= lastPage.pagination.max_page
        ? null
        : lastPageParam + 1,
    retry: defaultRetry,
  })

export const useTrackCheckoutOpened = (clientSecret: string) =>
  useMutation({
    mutationFn: (distinctId: string | undefined) =>
      fetch(getServerURL(`/v1/checkouts/client/${clientSecret}/opened`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distinct_id: distinctId }),
      }),
  })
