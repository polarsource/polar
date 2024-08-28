import { api } from '@/utils/api'
import {
  ListResourceTransaction,
  PayoutEstimate,
  ResponseError,
  TransactionSortProperty,
  TransactionType,
  TransactionsSummary,
} from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useSearchTransactions = (variables: {
  accountId?: string
  paymentUserId?: string
  paymentOrganizationId?: string
  excludePlatformFees?: boolean
  type?: TransactionType
  page?: number
  limit?: number
  sorting?: TransactionSortProperty[]
}): UseQueryResult<ListResourceTransaction> =>
  useQuery({
    queryKey: ['transactions', { ...variables }],
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
    retry: (failureCount, error) =>
      !(error instanceof ResponseError) && failureCount < 3,
    enabled,
  })
