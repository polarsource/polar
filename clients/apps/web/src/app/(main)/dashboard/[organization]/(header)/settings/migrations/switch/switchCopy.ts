import { SwitchCutoverStatus } from './switchRows'

// The status tabs map one-to-one onto what the records endpoint can filter, so
// every tab is a real server-side query rather than a client-side slice.
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
