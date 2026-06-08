import { usePolarClient } from '@/providers/PolarClientProvider'
import { queryClient } from '@/utils/query'
import { ClientResponseError, schemas, unwrap } from '@polar-sh/client'
import { defaultRetry } from './retry'
import {
  skipToken,
  useMutation,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query'

export const useOrganizationAccount = (organizationId?: string) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['finance', 'account', organizationId],
    queryFn: organizationId
      ? () =>
          unwrap(
            polar.GET('/v1/organizations/{id}/account', {
              params: { path: { id: organizationId } },
            }),
          )
      : skipToken,
    retry: (failureCount, error) => {
      if (
        error instanceof ClientResponseError &&
        (error.response.status === 403 || error.response.status === 404)
      ) {
        return false
      }
      return defaultRetry(failureCount, error as ClientResponseError)
    },
    throwOnError: false,
  })
}

export const usePayoutAccount = (payoutAccountId?: string) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['finance', 'payoutAccount', payoutAccountId],
    queryFn: payoutAccountId
      ? () =>
          unwrap(
            polar.GET('/v1/payout-accounts/{id}', {
              params: { path: { id: payoutAccountId } },
            }),
          )
      : skipToken,
    retry: defaultRetry,
    throwOnError: false,
  })
}

export const useTransactionsSummary = (accountId?: string) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['finance', accountId, 'transactions', 'summary'],
    queryFn: accountId
      ? () =>
          unwrap(
            polar.GET('/v1/transactions/summary', {
              params: { query: { account_id: accountId } },
            }),
          )
      : skipToken,
  })
}

export const usePayoutEstimate = (organizationId?: string) => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['finance', organizationId, 'payouts', 'estimate'],
    queryFn: organizationId
      ? () =>
          unwrap(
            polar.GET('/v1/payouts/estimate', {
              params: { query: { organization_id: organizationId } },
            }),
          )
      : skipToken,
  })
}

export const useCreatePayout = (organizationId?: string) => {
  const { polar } = usePolarClient()

  return useMutation({
    mutationFn: () => {
      if (!organizationId) {
        throw new Error('organizationId is required to create a payout')
      }
      return unwrap(
        polar.POST('/v1/payouts/', {
          body: { organization_id: organizationId },
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] })
    },
  })
}

export const usePayout = (
  payoutId?: string,
): UseQueryResult<schemas['Payout'] | undefined> => {
  return useQuery({
    queryKey: ['finance', 'payouts', payoutId],
    queryFn: () =>
      queryClient
        .getQueryData<schemas['ListResource_Payout_']>(['finance', 'payouts'])
        ?.items.find((payout) => payout.id === payoutId),
    enabled: !!payoutId,
  })
}

export const usePayouts = () => {
  const { polar } = usePolarClient()

  return useQuery({
    queryKey: ['finance', 'payouts'],
    queryFn: () => unwrap(polar.GET('/v1/payouts/')),
  })
}
