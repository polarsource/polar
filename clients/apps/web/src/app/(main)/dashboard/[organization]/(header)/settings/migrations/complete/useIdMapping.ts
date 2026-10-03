import { defaultRetry } from '@/hooks/queries/retry'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { buildIdMapping, MAPPING_KINDS, MappingKind } from './idMapping'

const PAGE_SIZE = 100

async function fetchAll<T>(
  fetchPage: (
    page: number,
  ) => Promise<{ items: T[]; pagination: { max_page: number } }>,
): Promise<T[]> {
  const first = await fetchPage(1)
  const rest = await Promise.all(
    Array.from({ length: first.pagination.max_page - 1 }, (_, index) =>
      fetchPage(index + 2),
    ),
  )
  return [first, ...rest].flatMap((page) => page.items)
}

export const useIdMapping = (migrationId: string, organizationId: string) =>
  useQuery({
    queryKey: ['merchantMigrationIdMapping', { migrationId, organizationId }],
    queryFn: async () => {
      const org = (page: number) => ({
        params: {
          query: { organization_id: organizationId, page, limit: PAGE_SIZE },
        },
      })
      const [records, subscriptions, customers, products, discounts] =
        await Promise.all([
          Promise.all(
            MAPPING_KINDS.map((entity) =>
              fetchAll((page) =>
                unwrap(
                  api.GET('/v1/merchant-migrations/{id}/records', {
                    params: {
                      path: { id: migrationId },
                      query: { entity, page, limit: PAGE_SIZE },
                    },
                  }),
                ),
              ),
            ),
          ),
          fetchAll((page) => unwrap(api.GET('/v1/subscriptions/', org(page)))),
          fetchAll((page) => unwrap(api.GET('/v1/customers/', org(page)))),
          fetchAll((page) => unwrap(api.GET('/v1/products/', org(page)))),
          fetchAll((page) => unwrap(api.GET('/v1/discounts/', org(page)))),
        ])
      return buildIdMapping(
        Object.fromEntries(
          MAPPING_KINDS.map((kind, index) => [kind, records[index]]),
        ) as Record<MappingKind, (typeof records)[number]>,
        { subscriptions, customers, products, discounts },
      )
    },
    retry: defaultRetry,
    enabled: !!migrationId && !!organizationId,
    staleTime: 60_000,
  })
