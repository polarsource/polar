import {
  DonationStatistics,
  ListResourceDonation,
  ResponseError,
  StatisticsIntervalEnum,
} from '@polar-sh/sdk'
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

export const useDonationStatistics = (variables: {
  toOrganizationId: string
  startDate: Date
  endDate: Date
  interval: StatisticsIntervalEnum
  groupByArticle?: boolean
}): UseQueryResult<DonationStatistics> =>
  useQuery({
    queryKey: ['donations', 'statistics', JSON.stringify(variables)],
    queryFn: () =>
      api.donations.statistics({
        toOrganizationId: variables.toOrganizationId,
        startDate: variables.startDate.toISOString().split('T')[0],
        endDate: variables.endDate.toISOString().split('T')[0],
        interval: variables.interval,
      }),
    retry: defaultRetry,
  })
