import { useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useListPersonalPledges = () =>
  useQuery(['listPersonalPledges'], () => api.pledges.listPersonalPledges(), {
    retry: defaultRetry,
  })
