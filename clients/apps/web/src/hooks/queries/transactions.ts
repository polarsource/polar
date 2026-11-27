import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import {
  UseQueryResult,
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useTransactionsSummary = (
  accountId: string,
): UseQueryResult<schemas['TransactionsSummary']> =>
  useQuery({
    queryKey: ['transactions_summary', accountId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/transactions/summary', {
          params: {
            query: { account_id: accountId },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!accountId,
  })

export const uniqueTransactions = (
  pages: schemas['ListResource_Transaction_'][],
): schemas['Transaction'][] => [
  ...new Map(
    pages.flatMap((page) => page.items.map((item) => [item.id, item])),
  ).values(),
]

export const useInfiniteTransactions = (
  accountId: string | undefined,
  parameters: {
    type?: schemas['TransactionType']
    exclude_platform_fees?: boolean
    limit?: number
    sorting?: schemas['TransactionSortProperty'][]
  },
) =>
  useInfiniteQuery({
    queryKey: ['transactions', 'infinite', { accountId, ...parameters }],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/transactions/search', {
          params: {
            query: { account_id: accountId, ...parameters, page: pageParam },
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
    enabled: !!accountId,
  })
