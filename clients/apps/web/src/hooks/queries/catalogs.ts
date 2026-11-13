import { getQueryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useMutation, useQuery } from '@tanstack/react-query'
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

export const useCatalog = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['catalogs', { id }],
    queryFn: () =>
      unwrap(api.GET('/v1/catalogs/{id}', { params: { path: { id: id! } } })),
    retry: defaultRetry,
    enabled: !!id,
  })

export const useCatalogs = (
  organizationId: string,
  page: number,
  limit: number,
) =>
  useQuery({
    queryKey: ['catalogs', 'list', { organizationId, page, limit }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/catalogs/', {
          params: {
            query: {
              organization_id: organizationId,
              status: ['live', 'archived', 'draft'],
              page,
              limit,
            },
          },
        }),
      ),
    retry: defaultRetry,
    // Catalogs are published from the CLI, so refetch on every refocus
    staleTime: 0,
  })

const catalogConfigQuery = (
  organizationId: string,
  catalogId: string | null | undefined,
) => ({
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
})

export const useCatalogConfig = (
  organizationId: string,
  catalogId: string | null | undefined,
) =>
  useQuery({
    ...catalogConfigQuery(organizationId, catalogId),
    enabled: !!catalogId,
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

export const usePublishCatalog = () =>
  useMutation({
    mutationFn: (id: string) =>
      api.POST('/v1/catalogs/{id}/publish', { params: { path: { id } } }),
    onSuccess: (result) => {
      if (result.error) {
        return
      }
      // Publishing changes which product, benefit and meter rows are current,
      // and repoints checkout links to the new products
      const queryClient = getQueryClient()
      for (const queryKey of [
        ['catalogs'],
        ['products'],
        ['benefits'],
        ['meters'],
        ['infinite', 'benefits'],
        ['infinite', 'meters'],
        ['checkout_links'],
      ]) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
