import { api } from '@/utils/client'
import { paths, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

type CompassTimezone = NonNullable<
  paths['/v1/compass/insights']['get']['parameters']['query']
>['timezone']

export const useCompassInsights = (organizationId: string, enabled = true) => {
  // The runtime value is always a valid IANA name; the generated param type
  // is a literal union the DOM API can't express. Part of the cache key: the
  // response varies by timezone, so a timezone change must not serve stale
  // insights.
  const timezone = Intl.DateTimeFormat().resolvedOptions()
    .timeZone as CompassTimezone
  return useQuery({
    queryKey: ['compass_insights', { organizationId, timezone }],
    enabled,
    queryFn: () =>
      unwrap(
        api.GET('/v1/compass/insights', {
          params: {
            query: {
              organization_id: organizationId,
              timezone,
            },
          },
        }),
      ),
    retry: defaultRetry,
  })
}
