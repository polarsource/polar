import { useMigrationRecords } from './merchantMigrations'

export type CountEntity = 'subscriptions' | 'products' | 'customers'

export interface EntityCount {
  importable: number
  skipped: number
}

interface RecordCount {
  count: number
  isLoading: boolean
  isError: boolean
}

// The listing carries its own total, so a `limit: 1` page is how this module
// asks "how many match?". A failed count would otherwise read as zero, which
// the caller can't tell apart from an empty catalog, so `isError` rides along.
const useRecordCount = (
  id: string,
  filters: Omit<Parameters<typeof useMigrationRecords>[1], 'page' | 'limit'>,
): RecordCount => {
  const query = useMigrationRecords(id, { ...filters, page: 1, limit: 1 })
  return {
    count: query.data?.pagination.total_count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

type QueryState = Pick<RecordCount, 'isLoading' | 'isError'>

const anyLoading = (states: QueryState[]) =>
  states.some((state) => state.isLoading)
const anyError = (states: QueryState[]) => states.some((state) => state.isError)

const useEntityCount = (
  id: string,
  entity: CountEntity,
): EntityCount & {
  isLoading: boolean
  isError: boolean
} => {
  const importable = useRecordCount(id, { entity, status: 'importable' })
  const skipped = useRecordCount(id, { entity, status: 'skipped' })
  return {
    importable: importable.count,
    skipped: skipped.count,
    isLoading: anyLoading([importable, skipped]),
    isError: anyError([importable, skipped]),
  }
}

// What the catalog import actually landed, read from the ledger rather than the
// import mutation, so the receipt survives a page reload. `remaining` is what
// the merchant could still import: importable by the pre-check, untouched by
// every import so far.
export const useMigrationImportOutcome = (id: string) => {
  const subscriptions = useRecordCount(id, {
    entity: 'subscriptions',
    importStatus: 'imported',
  })
  const products = useRecordCount(id, {
    entity: 'products',
    importStatus: 'imported',
  })
  const customers = useRecordCount(id, {
    entity: 'customers',
    importStatus: 'imported',
  })
  const remaining = useRecordCount(id, {
    status: 'importable',
    importStatus: 'pending',
  })
  const all = [subscriptions, products, customers, remaining]

  return {
    imported: {
      subscriptions: subscriptions.count,
      products: products.count,
      customers: customers.count,
    },
    remaining: remaining.count,
    isLoading: anyLoading(all),
    isError: anyError(all),
  }
}

export const useMigrationEntityCounts = (id: string) => {
  const subscriptions = useEntityCount(id, 'subscriptions')
  const products = useEntityCount(id, 'products')
  const customers = useEntityCount(id, 'customers')
  const attention = useRecordCount(id, { reasonLevel: 'action_required' })
  const all = [subscriptions, products, customers, attention]

  const counts: Record<CountEntity, EntityCount> = {
    subscriptions: {
      importable: subscriptions.importable,
      skipped: subscriptions.skipped,
    },
    products: { importable: products.importable, skipped: products.skipped },
    customers: { importable: customers.importable, skipped: customers.skipped },
  }

  return {
    counts,
    attentionCount: attention.count,
    isLoading: anyLoading(all),
    isError: anyError(all),
  }
}
