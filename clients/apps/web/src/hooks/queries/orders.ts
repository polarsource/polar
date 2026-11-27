import { api } from '@/utils/client'
import { operations, schemas, unwrap } from '@polar-sh/client'
import {
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useOrder = (
  id: string | undefined,
  initialData?: schemas['Order'],
) =>
  useQuery({
    queryKey: ['orders', { id }],
    queryFn: id
      ? () => unwrap(api.GET('/v1/orders/{id}', { params: { path: { id } } }))
      : skipToken,
    retry: defaultRetry,
    initialData,
  })

export const useOrders = (
  organizationId?: string,
  parameters?: Omit<
    NonNullable<operations['orders:list']['parameters']['query']>,
    'organization_id'
  >,
) =>
  useQuery({
    queryKey: ['orders', { organizationId, ...(parameters || {}) }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/orders/', {
          params: {
            query: {
              organization_id: organizationId,
              ...parameters,
            },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

// Rows can shift between pages while they load, so one can come back twice.
export const uniqueOrders = (
  pages: schemas['ListResource_Order_'][],
): schemas['Order'][] => [
  ...new Map(
    pages.flatMap((page) => page.items.map((item) => [item.id, item])),
  ).values(),
]

export const useInfiniteOrders = (
  organizationId: string,
  parameters?: Omit<
    NonNullable<operations['orders:list']['parameters']['query']>,
    'organization_id' | 'page'
  >,
) =>
  useInfiniteQuery({
    queryKey: ['orders', 'infinite', { organizationId, ...(parameters || {}) }],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/orders/', {
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
