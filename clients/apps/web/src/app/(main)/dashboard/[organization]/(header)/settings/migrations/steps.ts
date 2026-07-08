import { schemas } from '@polar-sh/client'

type Step = schemas['MerchantMigrationStep']

// Who moves a step forward. `you` (the merchant) is implicit and never badged;
// `polar` and `stripe` are surfaced so the merchant knows they're waiting on
// someone else.
export type StepOwner = 'you' | 'polar' | 'stripe'

export interface MigrationStepDef {
  step: Step
  title: string
  description: string
  owner: StepOwner
}

export const MIGRATION_STEPS: MigrationStepDef[] = [
  {
    step: 'source_setup',
    owner: 'you',
    title: 'Connect your Stripe account',
    description:
      'Paste a Stripe restricted API key so Polar can read your products, customers and subscriptions.',
  },
  {
    step: 'pre_check',
    owner: 'polar',
    title: 'Pre-check your catalog',
    description:
      'Polar verifies your products, prices and customers can be imported.',
  },
  {
    step: 'create_catalog',
    owner: 'polar',
    title: 'Switch new checkouts to Polar',
    description:
      'We import your catalog so new customers check out on Polar, not Stripe.',
  },
  {
    step: 'copy_cards',
    owner: 'stripe',
    title: 'Move saved cards',
    description:
      "Stripe copies your customers' saved cards onto Polar's account.",
  },
  {
    step: 'activate_subscriptions',
    owner: 'polar',
    title: 'Migrate existing subscriptions',
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

// Connecting completes `source_setup`, but the backend doesn't advance the step
// yet, so surface the next reachable step as current once connected.
export function currentStepKey(migration: schemas['MerchantMigration']): Step {
  if (!migration.source_connected) {
    return 'source_setup'
  }
  return migration.step === 'source_setup' ? 'pre_check' : migration.step
}
