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
import { useEffect, useMemo, useState } from 'react'

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

const COOLDOWN_PAYOUT_STATUSES: schemas['PayoutStatus'][] = [
  'pending',
  'in_transit',
  'succeeded',
  'failed',
  'held',
]

export const useNextPayoutAt = (account?: schemas['Account']) => {
  const { polar } = usePolarClient()
  const [now, setNow] = useState(() => Date.now())

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ['finance', account?.id, 'payouts', 'latest'],
    queryFn: account
      ? () =>
          unwrap(
            polar.GET('/v1/payouts/', {
              params: {
                query: {
                  account_id: account.id,
                  limit: 1,
                  sorting: ['-created_at'],
                  status: COOLDOWN_PAYOUT_STATUSES,
                },
              },
            }),
          )
      : skipToken,
  })

  const cooldownEndsAt = useMemo(() => {
    const latest = data?.items[0]
    if (!latest || !account) {
      return null
    }
    return new Date(
      new Date(latest.created_at).getTime() + account.payout_interval * 1000,
    )
  }, [data, account])

  useEffect(() => {
    if (!cooldownEndsAt) {
      return
    }
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.max(cooldownEndsAt.getTime() - Date.now(), 0),
    )
    return () => clearTimeout(timeout)
  }, [cooldownEndsAt])

  const nextPayoutAt: Date | null | undefined =
    !data || isError
      ? undefined
      : cooldownEndsAt && cooldownEndsAt.getTime() > now
        ? cooldownEndsAt
        : null

  return { nextPayoutAt, isFetching, refetch }
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
