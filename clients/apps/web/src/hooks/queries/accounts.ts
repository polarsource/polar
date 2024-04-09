import { api } from '@/utils/api'
import { ListResourceAccount } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListAccounts: () => UseQueryResult<ListResourceAccount> = () =>
  useQuery({
    queryKey: ['user', 'accounts'],
    queryFn: () => api.accounts.search({}),
    retry: defaultRetry,
  })
