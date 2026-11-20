import { renewalDate } from '../recordFormat'
import { SwitchCutoverStatus, SwitchRow } from './switchRows'

const LEGACY_PERIOD_END_SKIP_PREFIX =
  "It's set to cancel at the end of the period on the source"

export type SwitchFilter = 'all' | SwitchCutoverStatus

export const SWITCH_FILTERS: { value: SwitchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'skipped', label: 'Not switched' },
  { value: 'failed', label: 'Failed' },
  { value: 'moved', label: 'Switched' },
]

export const SWITCH_EMPTY_MESSAGES: Record<SwitchFilter, string> = {
  all: 'No imported subscriptions to switch.',
  skipped: 'Every subscription was switched.',
  failed: 'None failed to switch.',
  moved: 'Nothing has switched to Polar yet.',
}

export const SWITCH_INTRO =
  'Polar starts billing the subscriptions you pick, and stops them at your current provider first. It reads your provider again for each one, so anything that renews too soon or has no card stays put with a reason.'

export const SWITCH_UNDONE_WARNING =
  "Polar stops these subscriptions at your current provider and starts billing them. This cannot be undone. Before switching, turn off your provider's cancellation emails and automations, and make sure your cancellation webhooks ignore these cancellations."

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
  return `It's set to cancel at the end of the period at your current provider. You can move it to Polar, and it will still end on ${when}.`
}
