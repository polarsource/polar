import { api } from '@/utils/client'
import { schemas, unwrap } from '@spaire/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSearchTransactions = (variables: {
  account_id?: string
  payment_user_id?: string
  payment_organization_id?: string
  exclude_platform_fees?: boolean
  type?: schemas['TransactionType']
  page?: number
  limit?: number
  sorting?: schemas['TransactionSortProperty'][]
}): UseQueryResult<schemas['ListResource_Transaction_']> =>
  useQuery({
    queryKey: ['transactions', { ...variables }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/transactions/search', {
          params: { query: { ...variables } },
        }),
      ),
    retry: defaultRetry,
    enabled:
      !!variables.account_id ||
      !!variables.payment_user_id ||
      !!variables.payment_organization_id,
  })

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
