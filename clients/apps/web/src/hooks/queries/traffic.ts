import { api } from '@/utils/api'
import {
  ListResourceTrafficReferrer,
  Platforms,
  StatisticsTrafficIntervalEnum,
  TrafficStatistics,
} from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useTrafficStatistics = (variables: {
  organizationId?: string
  startDate: Date
  endDate: Date
  interval: StatisticsTrafficIntervalEnum
  groupByArticle?: boolean
}): UseQueryResult<TrafficStatistics> =>
  useQuery({
    queryKey: ['traffic', { ...variables }],
    queryFn: () =>
      api.traffic.statistics({
        organizationId: variables.organizationId,
        startDate: variables.startDate.toISOString().split('T')[0],
        endDate: variables.endDate.toISOString().split('T')[0],
        trafficInterval: variables.interval,
        groupByArticle: variables.groupByArticle,
      }),
    retry: defaultRetry,
    enabled: !!variables.organizationId,
  })

export const useTrafficTopReferrers = (variables: {
  organizationId?: string
  platform?: Platforms
  startDate: Date
  endDate: Date
  limit?: number
}): UseQueryResult<ListResourceTrafficReferrer> =>
  useQuery({
    queryKey: ['traffic', 'topReferrers', { ...variables }],
    queryFn: () =>
      api.traffic.referrers({
        organizationId: variables.organizationId ?? '',
        startDate: variables.startDate.toISOString().split('T')[0],
        endDate: variables.endDate.toISOString().split('T')[0],
        limit: variables.limit ?? 20,
      }),
    retry: defaultRetry,
    enabled: !!variables.organizationId,
  })
