import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useAccountCredits = (
  accountId: string | undefined,
): UseQueryResult<schemas['AccountCredit'][]> =>
  useQuery({
    queryKey: ['account', 'credits', accountId],
    queryFn: () =>
      unwrap(
        api.GET('/v1/accounts/{id}/credits', {
          params: { path: { id: accountId as string } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!accountId,
  })
