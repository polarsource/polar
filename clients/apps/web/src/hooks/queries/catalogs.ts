import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
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

export const useCatalogVersionLabels = (
  organization: schemas['Organization'],
) =>
  useQuery({
    queryKey: [
      'catalogs',
      'version_labels',
      { organizationId: organization.id },
    ],
    queryFn: async () => {
      const data = await unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: {
              organization_id: organization.id,
              status: ['live', 'archived'],
              limit: 100,
            },
          },
        }),
      )
      return new Map(
        data.items.map(({ id, name }) => [id, name]),
      )
    },
    retry: defaultRetry,
    enabled: !!organization.feature_settings?.config_as_code_enabled,
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

export const useCatalog = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['catalogs', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/catalogs/{id}', { params: { path: { id: id! } } })),
    retry: defaultRetry,
    enabled: !!id,
  })
