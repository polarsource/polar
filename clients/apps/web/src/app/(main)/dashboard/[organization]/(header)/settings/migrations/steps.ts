import { schemas } from '@polar-sh/client'

type Step = schemas['MerchantMigrationStep']

// Who moves a step forward. `you` (the merchant) is implicit and never badged;
// `polar` and `stripe` are surfaced so the merchant knows they're waiting on
// someone else.
export type StepOwner = 'you' | 'polar' | 'stripe'

export interface MigrationStepDef {
  step: Step
  title: string
  // Short label for the compact stepper, where the full title is too long.
  short: string
  description: string
  owner: StepOwner
}

export const MIGRATION_STEPS: MigrationStepDef[] = [
  {
    step: 'source_setup',
    owner: 'you',
    title: 'Connect your Stripe account',
    short: 'Connect',
    description:
      'Paste a Stripe restricted API key so Polar can read your products, customers and subscriptions.',
  },
  {
    step: 'pre_check',
    owner: 'polar',
    title: 'Pre-check your catalog',
    short: 'Pre-check',
    description:
      'Polar verifies your products, prices and customers can be imported.',
  },
  {
    step: 'create_catalog',
    owner: 'polar',
    title: 'Review & import your catalog',
    short: 'Import',
    description:
      'Import your products, customers and subscriptions so new checkouts run on Polar.',
  },
  {
    step: 'copy_cards',
    owner: 'stripe',
    title: 'Move saved cards',
    short: 'Move cards',
    description:
      "Stripe copies your customers' saved cards onto Polar's account.",
  },
  {
    step: 'activate_subscriptions',
    owner: 'polar',
    title: 'Migrate existing subscriptions',
    short: 'Cutover',
    description:
      'Polar takes over billing for active subscriptions and stops them on Stripe.',
  },
]

export const OWNER_LABELS: Record<StepOwner, string | null> = {
  you: null,
  polar: 'Polar',
  stripe: 'Stripe',
}

// Position within the visible steps. Terminal states (`cleanup`/`completed`)
// aren't listed as their own rows, so they resolve past the last step.
export function stepPosition(step: Step): number {
  const index = MIGRATION_STEPS.findIndex((s) => s.step === step)
  return index === -1 ? MIGRATION_STEPS.length : index
}

// The backend lags a step behind the visible work: connecting completes
// `source_setup`, and once the review table is shown the pre-check is done and
// the merchant is on Import. Surface the next reachable step as current so the
// stepper matches what's on screen.
export function currentStepKey(migration: schemas['MerchantMigration']): Step {
  if (!migration.source_connected) {
    return 'source_setup'
  }
  if (migration.step === 'source_setup') {
    return 'pre_check'
  }
  if (migration.step === 'pre_check') {
    return 'create_catalog'
  }
  return migration.step
}
