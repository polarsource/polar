import { defaultRetry } from '@/hooks/queries/retry'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { buildIdMapping, MAPPING_KINDS, MappingKind } from './idMapping'

const PAGE_SIZE = 100

interface Page<T> {
  items: T[]
  pagination: { max_page: number }
}

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
): Promise<T[]> {
  const first = await fetchPage(1)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.pagination.max_page - 1) }, (_, i) =>
      fetchPage(i + 2),
    ),
  )
  return [first, ...rest].flatMap((page) => page.items)
}

const fetchRecords = (id: string, entity: MappingKind) =>
  fetchAllPages((page) =>
    unwrap(
      api.GET('/v1/merchant-migrations/{id}/records', {
        params: { path: { id }, query: { entity, page, limit: PAGE_SIZE } },
      }),
    ),
  )

// Joins the migration's records to the Polar objects they became, using only
// public list endpoints: imported subscriptions carry the Stripe ID in
// `metadata.provider_subscription_id`, discounts in `metadata.stripe_coupon_id`,
// customers match on email, and products are reached through subscriptions.
export const useIdMapping = (migrationId: string, organizationId: string) =>
  useQuery({
    queryKey: ['merchantMigrationIdMapping', { migrationId, organizationId }],
    queryFn: async () => {
      const [recordLists, subscriptions, customers, products, discounts] =
        await Promise.all([
          Promise.all(
            MAPPING_KINDS.map((kind) => fetchRecords(migrationId, kind)),
          ),
          fetchAllPages((page) =>
            unwrap(
              api.GET('/v1/subscriptions/', {
                params: {
                  query: {
                    organization_id: organizationId,
                    page,
                    limit: PAGE_SIZE,
                  },
                },
              }),
            ),
          ),
          fetchAllPages((page) =>
            unwrap(
              api.GET('/v1/customers/', {
                params: {
                  query: {
                    organization_id: organizationId,
                    page,
                    limit: PAGE_SIZE,
                  },
                },
              }),
            ),
          ),
          fetchAllPages((page) =>
            unwrap(
              api.GET('/v1/products/', {
                params: {
                  query: {
                    organization_id: organizationId,
                    page,
                    limit: PAGE_SIZE,
                  },
                },
              }),
            ),
          ),
          fetchAllPages((page) =>
            unwrap(
              api.GET('/v1/discounts/', {
                params: {
                  query: {
                    organization_id: organizationId,
                    page,
                    limit: PAGE_SIZE,
                  },
                },
              }),
            ),
          ),
        ])
      const records = Object.fromEntries(
        MAPPING_KINDS.map((kind, index) => [kind, recordLists[index]]),
      ) as Record<MappingKind, (typeof recordLists)[number]>
      return buildIdMapping({
        records,
        subscriptions,
        customers,
        products,
        discounts,
      })
    },
    retry: defaultRetry,
    enabled: !!migrationId && !!organizationId,
    staleTime: 60_000,
  })
