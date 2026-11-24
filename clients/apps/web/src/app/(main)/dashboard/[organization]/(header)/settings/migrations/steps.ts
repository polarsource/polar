import { schemas } from '@polar-sh/client'
import { isSwitchChecklistKey } from './cards/panTransferCopy'

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
    title: 'Connect your billing provider',
    description:
      'Paste an API key so Polar can read your products, discounts, customers and subscriptions.',
    steps: ['source_setup'],
  },
  {
    key: 'assessment',
    short: 'Assessment',
    owner: 'polar',
    title: 'Assess & import your catalog',
    description:
      'Polar checks what can move, then imports the products, discounts and customers your subscriptions need.',
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
    // `create_catalog` means the catalog is already in Polar, so card movement
    // is the next real action even before the checklist starts.
    steps: ['create_catalog', 'copy_cards'],
  },
  {
    key: 'cutover',
    short: 'Switch',
    owner: 'polar',
    title: 'Switch billing to Polar',
    description:
      'Polar creates and activates the subscriptions you pick, then stops them at your current provider.',
    steps: ['activate_subscriptions'],
  },
]

// Lemon Squeezy sells license keys and files, which become Polar benefits
// between the import and the card move.
const BENEFITS_STEP: MigrationStepDef = {
  key: 'benefits',
  short: 'Benefits',
  owner: 'you',
  title: 'Set up benefits',
  description:
    'We found these in Lemon Squeezy. Polar creates them with the same settings and adds them to your products. You can edit them later from Benefits.',
  steps: ['create_catalog', 'set_up_benefits'],
}

export function migrationSteps(
  source: schemas['MerchantMigration']['source_platform'],
): MigrationStepDef[] {
  if (source !== 'lemon_squeezy') {
    return MIGRATION_STEPS
  }
  return MIGRATION_STEPS.flatMap((def) =>
    def.key === 'cards'
      ? [BENEFITS_STEP, { ...def, steps: ['copy_cards'] }]
      : [def],
  )
}

export const OWNER_LABELS: Record<StepOwner, string | null> = {
  you: null,
  varies: null,
  polar: 'Polar',
  stripe: 'Stripe',
}

// Where the merchant is. `completed` maps to no visible step, so it gets its
// own case rather than being clamped onto the last one.
export type MigrationPosition =
  | { kind: 'step'; index: number }
  | { kind: 'completed' }

// Card-checklist keys after the last card step belong on Switch, even if the
// backend still reports `copy_cards` for an in-progress migration.
export function visibleMigrationStep(
  migration: schemas['MerchantMigration'],
  panCurrentStepKey?: string | null,
): Step {
  if (
    migration.step === 'copy_cards' &&
    isSwitchChecklistKey(panCurrentStepKey)
  ) {
    return 'activate_subscriptions'
  }
  return migration.step
}

// Backend steps map to a visible step through `migrationSteps`, with two
// exceptions: `source_setup`, where connecting completes Connect even though
// the backend still reads it, so once connected we surface Assessment; and the
// trailing steps that no visible step covers, which fall through to `completed`
// below.
export function currentPosition(
  migration: schemas['MerchantMigration'],
  panCurrentStepKey?: string | null,
): MigrationPosition {
  if (!migration.source_connected) {
    return { kind: 'step', index: 0 }
  }
  const visible = visibleMigrationStep(migration, panCurrentStepKey)
  const step = visible === 'source_setup' ? 'pre_check' : visible
  const index = migrationSteps(migration.source_platform).findIndex((def) =>
    def.steps.includes(step),
  )
  return index === -1 ? { kind: 'completed' } : { kind: 'step', index }
}

export function currentStepDef(
  migration: schemas['MerchantMigration'],
  panCurrentStepKey?: string | null,
): MigrationStepDef | null {
  const position = currentPosition(migration, panCurrentStepKey)
  return position.kind === 'completed'
    ? null
    : migrationSteps(migration.source_platform)[position.index]
}
