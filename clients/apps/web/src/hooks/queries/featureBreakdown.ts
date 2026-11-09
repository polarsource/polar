import { api } from '@/utils/client'
import { operations, unwrap } from '@polar-sh/client'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

type Parameters = {
  start_date: string
  end_date: string
  interval: 'hour' | 'day' | 'week' | 'month'
}

const timezone = () =>
  Intl.DateTimeFormat().resolvedOptions()
    .timeZone as operations['feature-breakdown:get']['parameters']['query']['timezone']

export const useFeatureBreakdown = (
  organizationId: string,
  parameters: Parameters,
) => {
  const tz = timezone()
  return useQuery({
    queryKey: ['featureBreakdown', organizationId, { tz, ...parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/feature-breakdown/', {
          params: {
            query: {
              organization_id: organizationId,
              timezone: tz,
              ...parameters,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    retry: defaultRetry,
  })
}

export const useFeatureEconomics = (
  organizationId: string,
  name: string,
  parameters: Parameters,
) => {
  const tz = timezone()
  return useQuery({
    queryKey: ['featureEconomics', organizationId, name, { tz, ...parameters }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/feature-breakdown/{name}', {
          params: {
            path: { name },
            query: {
              organization_id: organizationId,
              timezone: tz,
              ...parameters,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    retry: defaultRetry,
  })
}

export const useFeatureHighlights = (
  organizationId: string,
  name: string,
  parameters: Omit<Parameters, 'interval'>,
) => {
  const tz = timezone()
  return useQuery({
    queryKey: [
      'featureHighlights',
      organizationId,
      name,
      { tz, ...parameters },
    ],
    queryFn: () =>
      unwrap(
        api.GET('/v1/feature-breakdown/{name}/highlights', {
          params: {
            path: { name },
            query: {
              organization_id: organizationId,
              timezone: tz,
              ...parameters,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    retry: defaultRetry,
  })
}
