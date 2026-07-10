import { schemas } from '@polar-sh/client'

type Step = schemas['MerchantMigrationStep']

// Who moves a step forward. `you` (the merchant) is implicit and never badged;
// `polar` and `stripe` are surfaced so the merchant knows they're waiting on
// someone else.
export type StepOwner = 'you' | 'polar' | 'stripe'

export interface MigrationStepDef {
  key: string
  title: string
  // Short label for the compact stepper.
  short: string
  description: string
  owner: StepOwner
  // Backend steps this visible step covers. Assessment merges the pre-check and
  // the import into one step: the merchant assesses and imports in one place.
  steps: Step[]
}

export const MIGRATION_STEPS: MigrationStepDef[] = [
  {
    key: 'connect',
    short: 'Connect',
    owner: 'you',
    title: 'Connect your Stripe account',
    description:
      'Paste a Stripe restricted API key so Polar can read your products, customers and subscriptions.',
    steps: ['source_setup'],
  },
  {
    key: 'assessment',
    short: 'Assessment',
    owner: 'polar',
    title: 'Assess & import your catalog',
    description:
      'Polar checks what can move, then imports your products, customers and subscriptions.',
    steps: ['pre_check', 'create_catalog'],
  },
  {
    key: 'cards',
    short: 'Card movement',
    owner: 'stripe',
    title: 'Move saved cards',
    description:
      "Stripe copies your customers' saved cards onto Polar's account.",
    steps: ['copy_cards'],
  },
  {
    key: 'cutover',
    short: 'Cutover',
    owner: 'polar',
    title: 'Cut over billing',
    description:
      'Polar takes over billing for active subscriptions and stops them on Stripe.',
    steps: ['activate_subscriptions'],
  },
]

export const OWNER_LABELS: Record<StepOwner, string | null> = {
  you: null,
  polar: 'Polar',
  stripe: 'Stripe',
}

// Which visible step the merchant is on. Connecting completes Connect even
// though the backend still reads `source_setup`, so once connected we surface
// Assessment. Terminal states resolve to the last step.
export function currentVisibleIndex(
  migration: schemas['MerchantMigration'],
): number {
  if (!migration.source_connected) {
    return 0
  }
  const step = migration.step === 'source_setup' ? 'pre_check' : migration.step
  const index = MIGRATION_STEPS.findIndex((def) => def.steps.includes(step))
  return index === -1 ? MIGRATION_STEPS.length - 1 : index
}

export function currentStepDef(
  migration: schemas['MerchantMigration'],
): MigrationStepDef {
  return MIGRATION_STEPS[currentVisibleIndex(migration)]
}
