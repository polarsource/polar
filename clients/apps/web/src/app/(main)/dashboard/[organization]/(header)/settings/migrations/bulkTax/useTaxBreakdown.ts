import { useAllMigrationRecords } from '@/hooks/queries/merchantMigrations'
import { taxBreakdown } from './bulkTaxRecords'

export const useTaxBreakdown = (migrationId: string) =>
  useAllMigrationRecords(migrationId, 'subscriptions', taxBreakdown)
