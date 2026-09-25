import { renewalDate } from '../recordFormat'
import { SwitchCutoverStatus, SwitchRow } from './switchRows'

const LEGACY_PERIOD_END_SKIP_PREFIX =
  "It's set to cancel at the end of the period on the source"

export type SwitchFilter = 'all' | SwitchCutoverStatus

export const SWITCH_FILTERS: { value: SwitchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'skipped', label: 'Left on Stripe' },
  { value: 'failed', label: 'Failed' },
  { value: 'moved', label: 'Switched' },
]

export const SWITCH_EMPTY_MESSAGES: Record<SwitchFilter, string> = {
  all: 'No imported subscriptions to switch.',
  skipped: 'None were left on Stripe.',
  failed: 'None failed to switch.',
  moved: 'Nothing has switched to Polar yet.',
}

export const SWITCH_INTRO =
  'Polar starts billing the subscriptions you pick, and stops them on Stripe first. It reads Stripe again for each one, so anything that renews too soon or has no card stays put with a reason.'

export const SWITCH_UNDONE_WARNING =
  'Polar stops these subscriptions on Stripe and starts billing them. This cannot be undone.'

// Always scoped to prepared subscriptions (customer + product already in
// Polar). The cutover report uses the same set; listing every staged row
// would fill the All tab with subscriptions that cannot be switched.
export function switchRecordsParams(
  filter: SwitchFilter,
  page: number,
  pageSize: number,
) {
  return {
    entity: 'subscriptions' as const,
    dependenciesImported: true as const,
    ...(filter !== 'all' ? { cutoverStatus: filter } : {}),
    page,
    limit: pageSize,
  }
}

export function periodEndMoveNotice(row: SwitchRow): string | null {
  if (row.cutover_status === 'moved') {
    return null
  }
  const legacySkip =
    row.cutover_error?.startsWith(LEGACY_PERIOD_END_SKIP_PREFIX) ?? false
  if (row.cutover_error != null && !legacySkip) {
    return null
  }
  if (!row.cancels_at_period_end && !legacySkip) {
    return null
  }
  const when = renewalDate(row) ?? 'that date'
  return `It's set to cancel at the end of the period on Stripe. You can move it to Polar, and it will still end on ${when}.`
}
