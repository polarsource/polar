import type { PruneEntry } from '@/schemas/BillingConfig'

export const removable = (entry: PruneEntry) =>
  entry.customers === 0 && entry.referenced_by.length === 0
