import {
  ListResourceTransaction,
  PayoutEstimate,
  TransactionType,
  TransactionsSummary,
} from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../..'
import { defaultRetry } from './retry'

export const useSearchTransactions = (variables: {
  accountId?: string
  paymentUserId?: string
  paymentOrganizationId?: string
  excludePlatformFees?: boolean
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

export const useTransactionsSummary = (
  accountId: string,
): UseQueryResult<TransactionsSummary> =>
  useQuery({
    queryKey: ['transactions_summary', accountId],
    queryFn: () =>
      api.transactions.getSummary({
        accountId,
      }),
    retry: defaultRetry,
  })

export const usePayoutEstimate = (
  accountId: string,
  enabled: boolean = true,
): UseQueryResult<PayoutEstimate> =>
  useQuery({
    queryKey: ['payout_estimate', accountId],
    queryFn: () => api.transactions.getPayoutEstimate({ accountId }),
    retry: defaultRetry,
    enabled,
  })
