import { useQuery } from '@tanstack/react-query'
import { fetchAllSubscriptionRecords, taxBreakdown } from './bulkTaxRecords'

// Under the records key so any record invalidation refreshes the breakdown.
export const useTaxBreakdown = (migrationId: string) =>
  useQuery({
    queryKey: [
      'merchantMigrationRecords',
      { id: migrationId, taxBreakdown: true },
    ],
    queryFn: async () =>
      taxBreakdown(await fetchAllSubscriptionRecords(migrationId)),
  })
