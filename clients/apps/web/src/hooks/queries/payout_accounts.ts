import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
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
