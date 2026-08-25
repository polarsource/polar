import { useMerchantMigrationRecordSummary } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'

export type CountEntity = 'subscriptions' | 'products' | 'customers'

export type EntityCount = schemas['MerchantMigrationRecordSummaryEntity']

const COUNT_ENTITIES: CountEntity[] = ['subscriptions', 'products', 'customers']

const empty = (entity: CountEntity): EntityCount => ({
  entity,
  total: 0,
  importable: 0,
  skipped: 0,
  imported: 0,
  pending: 0,
  action_required: 0,
  selectable: 0,
})

export const useRecordSummary = (id: string) => {
  const query = useMerchantMigrationRecordSummary(id)

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
      selectableTotal: counts.subscriptions.selectable,
      attentionCount: counts.subscriptions.action_required,
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
