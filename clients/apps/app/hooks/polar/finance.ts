import { useSession } from '@/providers/SessionProvider'
import { queryClient } from '@/utils/query'
import { schemas } from '@polar-sh/client'
import {
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query'

export const useOrganizationAccount = (
  organizationId?: string,
): UseQueryResult<schemas['Account']> => {
  const { session } = useSession()
  return useQuery({
    queryKey: ['finance', 'account', organizationId],
    queryFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/organizations/${organizationId}/account`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
    enabled: !!organizationId,
  })
}

export const useTransactionsSummary = (
  accountId?: string,
): UseQueryResult<schemas['TransactionsSummary']> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['finance', accountId, 'transactions', 'summary'],
    queryFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/transactions/summary?account_id=${accountId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
    enabled: !!accountId,
  })
}

export const usePayoutEstimate = (
  accountId?: string,
): UseQueryResult<schemas['PayoutEstimate']> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['finance', accountId, 'payouts', 'estimate'],
    queryFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/payouts/estimate?account_id=${accountId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
    enabled: !!accountId,
  })
}

export const useCreatePayout = (
  accountId?: string,
): UseMutationResult<schemas['Payout']> => {
  const { session } = useSession()

  return useMutation({
    mutationFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/payouts/`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
          method: 'POST',
          body: JSON.stringify({
            account_id: accountId,
          }),
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
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
        .getQueryData<{
          items: schemas['Payout'][]
          pagination: schemas['Pagination']
        }>(['finance', 'payouts'])
        ?.items.find((payout) => payout.id === payoutId),
    enabled: !!payoutId,
  })
}

export const usePayouts = (): UseQueryResult<{
  items: schemas['Payout'][]
  pagination: schemas['Pagination']
}> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['finance', 'payouts'],
    queryFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL ?? 'https://api.polar.sh'}/v1/payouts/`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
  })
}
