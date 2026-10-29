import { OrganizationContext } from '@/providers/maintainerOrganization'
import { api } from '@/utils/client'
import { getCatalogMarkers, getPeriodEnd } from '@/utils/metrics'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { useContext } from 'react'
import { ParsedMetricPeriod } from './metrics'
import { defaultRetry } from './retry'

export const useLiveCatalog = (organizationId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['catalogs', 'live', { organizationId }],
    queryFn: async () => {
      const data = await unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: {
              organization_id: organizationId,
              status: 'live',
              limit: 1,
            },
          },
        }),
      )
      return data.items[0] ?? null
    },
    retry: defaultRetry,
    // Catalogs are published from the CLI, so refetch on every refocus
    staleTime: 0,
    enabled,
  })

export const useCatalogs = (
  organizationId: string,
  page: number,
  limit: number,
) =>
  useQuery({
    queryKey: ['catalogs', { organizationId, page, limit }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: {
              organization_id: organizationId,
              status: ['live', 'archived'],
              page,
              limit,
            },
          },
        }),
      ),
    retry: defaultRetry,
    staleTime: 0,
  })

export const useCatalogMarkers = (
  periods: ParsedMetricPeriod[] | undefined,
  interval: schemas['TimeInterval'],
  enabled: boolean,
) => {
  const { organization } = useContext(OrganizationContext)
  const first = periods?.[0]?.timestamp
  const last = periods?.[periods.length - 1]?.timestamp
  const publishedAfter = first?.toISOString()
  const publishedBefore = last && getPeriodEnd(last, interval).toISOString()

  const { data } = useQuery({
    queryKey: [
      'catalogs',
      'published',
      { organizationId: organization.id, publishedAfter, publishedBefore },
    ],
    queryFn: () =>
      unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: {
              organization_id: organization.id,
              status: ['live', 'archived'],
              published_after: publishedAfter,
              published_before: publishedBefore,
              limit: 100,
            },
          },
        }),
      ),
    retry: defaultRetry,
    staleTime: 0,
    enabled:
      enabled &&
      organization.feature_settings?.config_as_code_enabled === true &&
      !!publishedAfter,
  })

  if (!periods || !data) return undefined
  return getCatalogMarkers(
    periods.map((period) => period.timestamp),
    data.items,
  )
}
