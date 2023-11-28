import { ListResourceTransaction, TransactionType } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../..'
import { defaultRetry } from './retry'

export const useSearchTransactions = ({
  accountId,
  type,
  page = 1,
  limit = 20,
}: {
  accountId: string
  type?: TransactionType
  page?: number
  limit?: number
  sorting?: Array<string>
}): UseQueryResult<ListResourceTransaction> =>
  useQuery({
    queryKey: [
      'transactions',
      accountId,
      JSON.stringify({ type, page, limit }),
    ],
    queryFn: () =>
      api.transactions.searchTransactions({
        accountId,
        type,
        page,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!accountId,
  })
