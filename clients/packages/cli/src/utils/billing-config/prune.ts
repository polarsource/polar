import type { PruneEntry } from '@/schemas/BillingConfig'

export const removable = (entry: PruneEntry) =>
  entry.customer_count === 0 && entry.referenced_by.length === 0
