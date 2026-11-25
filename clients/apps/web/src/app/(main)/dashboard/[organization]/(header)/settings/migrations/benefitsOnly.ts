import { schemas } from '@polar-sh/client'
import { useRecordSummary } from './review/recordSummary'
import { BENEFITS_STEP } from './steps'

const AFTER_IMPORT: schemas['MerchantMigrationStep'][] = [
  ...BENEFITS_STEP.steps,
  'completed',
]

// A Lemon Squeezy migration with no subscriptions that can move only brings
// benefits over: there are no cards to move and nothing to switch.
export function useBenefitsOnly(
  migration: schemas['MerchantMigration'],
): boolean {
  const summary = useRecordSummary(migration.id)
  return (
    migration.source_platform === 'lemon_squeezy' &&
    AFTER_IMPORT.includes(migration.step) &&
    !summary.isLoading &&
    !summary.isError &&
    summary.counts.subscriptions.importable === 0
  )
}
