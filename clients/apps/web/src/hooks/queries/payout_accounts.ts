import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const usePayoutAccount = (payoutAccountId: string | undefined) =>
  useQuery({
    queryKey: ['payoutAccount', payoutAccountId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/payout-accounts/{id}', {
          params: { path: { id: payoutAccountId as string } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!payoutAccountId,
  })

export const usePayoutAccounts = () =>
  useQuery({
    queryKey: ['payoutAccounts'],
    queryFn: () => unwrap(api.GET('/v1/payout-accounts/')),
    retry: defaultRetry,
  })

export const useDeletePayoutAccount = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.DELETE('/v1/payout-accounts/{id}', {
        params: { path: { id } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      queryClient.invalidateQueries({ queryKey: ['payoutAccounts'] })
    },
  })
}

export const useSetOrganizationPayoutAccount = (organizationId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payoutAccountId: string) =>
      api.PATCH('/v1/organizations/{id}/payout-account', {
        params: { path: { id: organizationId } },
        body: { payout_account_id: payoutAccountId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      queryClient.invalidateQueries({ queryKey: ['payoutAccounts'] })
    },
  })
}
