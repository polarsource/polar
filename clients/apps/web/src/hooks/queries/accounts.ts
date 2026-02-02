import { api } from '@/utils/client'
import { schemas, unwrap } from '@spaire/client'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListAccounts: () => UseQueryResult<
  schemas['ListResource_Account_']
> = () =>
  useQuery({
    queryKey: ['user', 'accounts'],
    queryFn: () => unwrap(api.GET('/v1/accounts/search')),
    retry: defaultRetry,
  })

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
