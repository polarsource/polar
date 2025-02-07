import { api } from '@/utils/client'
import { components, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSearchTransactions = (variables: {
  account_id?: string
  payment_user_id?: string
  payment_organization_id?: string
  exclude_platform_fees?: boolean
  type?: components['schemas']['TransactionType']
  page?: number
  limit?: number
  sorting?: components['schemas']['TransactionSortProperty'][]
}): UseQueryResult<components['schemas']['ListResource_Transaction_']> =>
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
): UseQueryResult<components['schemas']['TransactionsSummary']> =>
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

export const usePayoutEstimate = (
  accountId: string,
  enabled: boolean = true,
): UseQueryResult<components['schemas']['PayoutEstimate']> =>
  useQuery({
    queryKey: ['payout_estimate', accountId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/transactions/payouts', {
          params: { query: { account_id: accountId } },
        }),
      ),
    retry: defaultRetry,
    enabled,
  })
