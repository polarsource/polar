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
  accountId?: string
  type?: TransactionType
  page?: number
  limit?: number
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

export const usePayoutTransactions = ({
  accountId,
  page = 1,
  limit = 20,
}: {
  accountId?: string
  page?: number
  limit?: number
}): UseQueryResult<ListResourceTransaction> =>
  useQuery({
    queryKey: [
      'transactions',
      'payouts',
      accountId,
      JSON.stringify({ page, limit }),
    ],
    queryFn: () =>
      api.transactions.searchTransactions({
        accountId,
        type: TransactionType.PAYOUT,
        page,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!accountId,
  })

export const useTransferTransactions = ({
  accountId,
  page = 1,
  limit = 20,
}: {
  accountId?: string
  page?: number
  limit?: number
}): UseQueryResult<ListResourceTransaction> =>
  useQuery({
    queryKey: [
      'transactions',
      'transfers',
      accountId,
      JSON.stringify({ page, limit }),
    ],
    queryFn: () =>
      api.transactions.searchTransactions({
        accountId,
        type: TransactionType.TRANSFER,
        page,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!accountId,
  })

export const useUserPaymentTransactions = ({
  userId,
  page = 1,
  limit = 20,
}: {
  userId?: string
  page?: number
  limit?: number
}): UseQueryResult<ListResourceTransaction> =>
  useQuery({
    queryKey: [
      'transactions',
      'payments',
      userId,
      JSON.stringify({ page, limit }),
    ],
    queryFn: () =>
      api.transactions.searchTransactions({
        paymentUserId: userId,
        type: TransactionType.PAYMENT,
        page,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!userId,
  })

export const useOrganizationPaymentTransactions = ({
  organizationId,
  page = 1,
  limit = 20,
}: {
  organizationId?: string
  page?: number
  limit?: number
}): UseQueryResult<ListResourceTransaction> =>
  useQuery({
    queryKey: [
      'transactions',
      'payments',
      organizationId,
      JSON.stringify({ page, limit }),
    ],
    queryFn: () =>
      api.transactions.searchTransactions({
        paymentOrganizationId: organizationId,
        type: TransactionType.TRANSFER,
        page,
        limit,
      }),
    retry: defaultRetry,
    enabled: !!organizationId,
  })
