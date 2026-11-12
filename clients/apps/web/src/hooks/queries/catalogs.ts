import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
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
              status: ['live', 'archived', 'draft'],
              limit: 100,
            },
          },
        }),
      )
      return new Map(
        data.items.map(({ id, name, status, published_at }) => [
          id,
          { name, status, published_at },
        ]),
      )
    },
    retry: defaultRetry,
    enabled: !!organization.feature_settings?.config_as_code_enabled,
  })

export const useInfiniteCatalogs = (organizationId: string) =>
  useInfiniteQuery({
    queryKey: ['infinite', 'catalogs', { organizationId }],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: { organization_id: organizationId, page: pageParam },
          },
        }),
      ),
    retry: defaultRetry,
    staleTime: 0,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPageParam >= lastPage.pagination.max_page ? null : lastPageParam + 1,
  })

export const useRemovedCatalogItems = (organizationId: string) =>
  useQuery({
    queryKey: ['catalogs', 'removed', { organizationId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/catalogs/removed', {
          params: { query: { organization_id: organizationId } },
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

export const useCatalogConfig = (
  organizationId: string,
  catalogId: string | null | undefined,
) =>
  useQuery({
    queryKey: ['catalogs', 'config', { id: catalogId }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/config/', {
          params: {
            query: { organization_id: organizationId, catalog_id: catalogId },
          },
        }),
      ),
    retry: defaultRetry,
    enabled: !!catalogId,
  })
