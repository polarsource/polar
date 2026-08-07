import { schemas } from '@polar-sh/client'

type Step = schemas['MerchantMigrationStep']

// Who moves a step forward. `you` (the merchant) is implicit and never badged;
// `polar` and `stripe` are surfaced so the merchant knows they're waiting on
// someone else.
export type StepOwner = 'you' | 'polar' | 'stripe' | 'varies'

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
    steps: ['pre_check'],
  },
  {
    key: 'cards',
    short: 'Card movement',
    // No single party owns this step; the checklist inside it badges per step.
    owner: 'varies',
    title: 'Move saved cards',
    description:
      "Follow the checklist to move your customers' saved cards onto Polar.",
    // `create_catalog` means the catalog is already in Polar, so the merchant's
    // next real action is card movement even before they start the checklist.
    steps: ['create_catalog', 'copy_cards'],
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
  varies: null,
  polar: 'Polar',
  stripe: 'Stripe',
}

// Where the merchant is. `cleanup` and `completed` map to no visible step, so
// they get their own case rather than being clamped onto the last one.
export type MigrationPosition =
  | { kind: 'step'; index: number }
  | { kind: 'completed' }

// Every backend step maps to a visible step through `MIGRATION_STEPS`, except
// `source_setup`: connecting completes Connect even though the backend still
// reads `source_setup`, so once connected we surface Assessment instead.
export function currentPosition(
  migration: schemas['MerchantMigration'],
): MigrationPosition {
  if (!migration.source_connected) {
    return { kind: 'step', index: 0 }
  }
  const step = migration.step === 'source_setup' ? 'pre_check' : migration.step
  const index = MIGRATION_STEPS.findIndex((def) => def.steps.includes(step))
  return index === -1 ? { kind: 'completed' } : { kind: 'step', index }
}

export function currentStepDef(
  migration: schemas['MerchantMigration'],
): MigrationStepDef | null {
  const position = currentPosition(migration)
  return position.kind === 'completed' ? null : MIGRATION_STEPS[position.index]
}
