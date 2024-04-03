import { ListResourceDonation, ResponseError } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useSearchDonations = (variables: {
  toOrganizationId: string
  limit: number
  page: number
}): UseQueryResult<ListResourceDonation, ResponseError> =>
  useQuery({
    queryKey: ['donations', 'search', JSON.stringify(variables)],
    queryFn: () =>
      api.donations.searchDonations({
        ...variables,
      }),
    retry: defaultRetry,
  })
