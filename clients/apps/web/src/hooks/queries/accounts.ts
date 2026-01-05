import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
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
