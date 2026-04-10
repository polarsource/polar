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

export const useDeletePayoutAccount = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.DELETE('/v1/payout-accounts/{id}', {
        params: { path: { id } },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      queryClient.invalidateQueries({ queryKey: ['payoutAccount'] })
    },
  })
}
