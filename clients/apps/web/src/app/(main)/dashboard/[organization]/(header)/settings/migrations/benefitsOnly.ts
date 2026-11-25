import { schemas } from '@polar-sh/client'
import { useRecordSummary } from './review/recordSummary'
import { BENEFITS_STEP } from './steps'

const AFTER_IMPORT: schemas['MerchantMigrationStep'][] = [
  ...BENEFITS_STEP.steps,
  'completed',
]

// A Lemon Squeezy migration with no subscriptions that can move only brings
// benefits over: there are no cards to move and nothing to switch. `null`
// while the summary loads, so no step offers the wrong next action meanwhile.
export function useBenefitsOnly(
  migration: schemas['MerchantMigration'],
): boolean | null {
  const applies =
    migration.source_platform === 'lemon_squeezy' &&
    AFTER_IMPORT.includes(migration.step)
  const summary = useRecordSummary(applies ? migration.id : '')
  if (!applies || summary.isError) {
    return false
  }
  if (summary.isLoading) {
    return null
  }
  return summary.counts.subscriptions.importable === 0
}
