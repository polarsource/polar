import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { defaultRetry } from './retry'

export type CountEntity = 'subscriptions' | 'products' | 'customers'

export type EntityCount = schemas['MerchantMigrationRecordSummaryEntity']

const COUNT_ENTITIES: CountEntity[] = ['subscriptions', 'products', 'customers']

const empty = (entity: CountEntity): EntityCount => ({
  entity,
  total: 0,
  importable: 0,
  skipped: 0,
  imported: 0,
  selectable: 0,
})

export const merchantMigrationRecordSummaryKey = (id: string) => [
  'merchantMigrationRecordSummary',
  { id },
]

// One read for every count the UI shows: asking per number made the server
// re-read and re-classify the whole staged catalog once per count.
export const useMerchantMigrationRecordSummary = (id: string) => {
  const query = useQuery({
    queryKey: merchantMigrationRecordSummaryKey(id),
    queryFn: () =>
      unwrap(
        api.GET('/v1/merchant-migrations/{id}/records/summary', {
          params: { path: { id } },
        }),
      ),
    retry: defaultRetry,
    enabled: !!id,
  })

  const derived = useMemo(() => {
    const counts = Object.fromEntries(
      COUNT_ENTITIES.map((entity) => [
        entity,
        query.data?.entities.find((entry) => entry.entity === entity) ??
          empty(entity),
      ]),
    ) as Record<CountEntity, EntityCount>

    return {
      counts,
      imported: {
        subscriptions: counts.subscriptions.imported,
        products: counts.products.imported,
        customers: counts.customers.imported,
      },
      selectableTotal: COUNT_ENTITIES.reduce(
        (total, entity) => total + counts[entity].selectable,
        0,
      ),
      attentionCount: query.data?.action_required ?? 0,
    }
  }, [query.data])

  return {
    ...derived,
    isLoading: query.isLoading,
    // Distinct from `isLoading`, which is false whenever anything is cached. A
    // refetch after an import serves the pre-import numbers until it lands, so
    // callers that draw a conclusion from a zero count have to wait for this.
    isFetching: query.isFetching,
    // A failed count would otherwise read as zero, which the caller can't tell
    // apart from an empty catalog.
    isError: query.isError,
  }
}
