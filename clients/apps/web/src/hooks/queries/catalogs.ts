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
        data.items.map(({ id, name, status }) => [id, { name, status }]),
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

export type ProductVersion = {
  product_id: string
  name: string | null
  published_at: string | null
  is_current: boolean
}

const listAllPages = async <T>(
  fetchPage: (
    page: number,
  ) => Promise<{ items: T[]; pagination: { max_page: number } }>,
) => {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const data = await fetchPage(page)
    items.push(...data.items)
    if (page >= data.pagination.max_page) {
      return items
    }
  }
}

// The current version and the 10 most recent previous ones, plus the one being viewed.
export const useProductVersions = (
  organizationId: string,
  product: schemas['Product'],
  enabled: boolean,
) =>
  useQuery({
    queryKey: [
      'catalogs',
      'product_versions',
      {
        organizationId,
        externalId: product.external_id,
        productId: product.id,
      },
    ],
    queryFn: async (): Promise<ProductVersion[]> => {
      const externalId = product.external_id ?? ''
      const [currentProducts, previousProducts, catalogs] = await Promise.all([
        unwrap(
          api.GET('/v1/products/', {
            params: {
              query: {
                organization_id: organizationId,
                external_id: externalId,
                limit: 1,
              },
            },
          }),
        ),
        unwrap(
          api.GET('/v1/products/', {
            params: {
              query: {
                organization_id: organizationId,
                external_id: externalId,
                is_current: false,
                limit: 10,
              },
            },
          }),
        ),
        listAllPages((page) =>
          unwrap(
            api.GET('/v1/catalogs/', {
              params: {
                query: {
                  organization_id: organizationId,
                  status: ['live', 'archived'],
                  page,
                  limit: 100,
                },
              },
            }),
          ),
        ),
      ])
      const current = currentProducts.items[0]
      const products = new Map(
        [product, ...currentProducts.items, ...previousProducts.items].map(
          (version) => [version.id, version],
        ),
      )
      const catalogsById = new Map(
        catalogs.map((catalog) => [catalog.id, catalog]),
      )
      return [...products.values()]
        .map((version) => {
          const catalog = version.catalog_id
            ? catalogsById.get(version.catalog_id)
            : undefined
          return {
            product_id: version.id,
            name: catalog?.name ?? null,
            published_at: catalog?.published_at ?? null,
            is_current: version.id === current?.id,
          }
        })
        .sort((a, b) =>
          (b.published_at ?? '').localeCompare(a.published_at ?? ''),
        )
    },
    retry: defaultRetry,
    staleTime: 0,
    enabled: enabled && product.external_id !== null,
  })
