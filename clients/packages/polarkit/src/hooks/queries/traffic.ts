import {
  Platforms,
  StatisticsIntervalEnum,
  TrafficReferrers,
  TrafficStatistics,
} from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useTrafficStatistics = (variables: {
  orgName?: string
  platform?: Platforms
  startDate: Date
  endDate: Date
  interval: StatisticsIntervalEnum
  groupByArticle?: boolean
}): UseQueryResult<TrafficStatistics> =>
  useQuery({
    queryKey: ['traffic', JSON.stringify(variables)],
    queryFn: () =>
      api.traffic.statistics({
        organizationName: variables.orgName ?? '',
        platform: variables.platform ?? Platforms.GITHUB,
        startDate: variables.startDate.toISOString().split('T')[0],
        endDate: variables.endDate.toISOString().split('T')[0],
        interval: variables.interval,
        groupByArticle: variables.groupByArticle,
      }),
    retry: defaultRetry,
    enabled: !!variables.orgName,
  })

export const useTrafficTopReferrers = (variables: {
  orgName?: string
  platform?: Platforms
  startDate: Date
  endDate: Date
}): UseQueryResult<TrafficReferrers> =>
  useQuery({
    queryKey: ['traffic', 'topReferrers', JSON.stringify(variables)],
    queryFn: () =>
      api.traffic.topReferrers({
        organizationName: variables.orgName ?? '',
        platform: variables.platform ?? Platforms.GITHUB,
        startDate: variables.startDate.toISOString().split('T')[0],
        endDate: variables.endDate.toISOString().split('T')[0],
      }),
    retry: defaultRetry,
    enabled: !!variables.orgName,
  })
