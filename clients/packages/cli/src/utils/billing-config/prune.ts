import type { PruneEntry } from '@/schemas/BillingConfig'

export const removable = (entry: PruneEntry) =>
  !entry.in_use && entry.referenced_by.length === 0
