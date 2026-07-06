import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { paths, schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

type CompassTimezone = NonNullable<
  paths['/v1/compass/insights']['get']['parameters']['query']
>['timezone']

export const useCompassInsights = (organizationId: string) =>
  useQuery({
    queryKey: ['compass_insights', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/compass/insights', {
          params: {
            query: {
              organization_id: organizationId,
              // The runtime value is always a valid IANA name; the generated
              // param type is a literal union the DOM API can't express.
              timezone: Intl.DateTimeFormat().resolvedOptions()
                .timeZone as CompassTimezone,
            },
          },
        }),
      ),
    retry: defaultRetry,
  })

export const useInsightFeedback = (organizationId: string) =>
  useMutation({
    mutationFn: ({
      insightKey,
      action,
    }: {
      insightKey: string
      action: schemas['InsightFeedbackAction']
    }) =>
      api.POST('/v1/compass/insights/{insight_key}/feedback', {
        params: { path: { insight_key: insightKey } },
        body: { action },
      }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      // The list endpoint excludes insights with feedback, so a refetch is
      // what actually removes the card.
      getQueryClient().invalidateQueries({
        queryKey: ['compass_insights', { organizationId }],
      })
    },
  })
