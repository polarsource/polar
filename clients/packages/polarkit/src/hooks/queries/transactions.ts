import { ListResourceTransaction, TransactionType } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../..'
import { defaultRetry } from './retry'

export const useSearchTransactions = (variables: {
  accountId?: string
  paymentUserId?: string
  paymentOrganizationId?: string
  type?: TransactionType
  page?: number
  limit?: number
  sorting?: string[]
}): UseQueryResult<ListResourceTransaction> =>
  useQuery({
    queryKey: ['transactions', JSON.stringify(variables)],
    queryFn: () =>
      api.transactions.searchTransactions({
        ...variables,
      }),
    retry: defaultRetry,
    enabled:
      !!variables.accountId ||
      !!variables.paymentUserId ||
      !!variables.paymentOrganizationId,
  })
