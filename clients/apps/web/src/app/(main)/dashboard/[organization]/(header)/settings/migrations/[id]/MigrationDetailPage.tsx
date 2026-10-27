'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useMerchantMigration,
  usePanTransfer,
} from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, Spinner, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PanTransferPanel } from '../cards/PanTransferPanel'
import { ImportedStep } from '../ImportedStep'
import { MigrationStepper } from '../MigrationStepper'
import { PrecheckPanel } from '../PrecheckPanel'
import { ReviewTable } from '../review/ReviewTable'
import {
  currentStepDef,
  MigrationStepDef,
  OWNER_LABELS,
  visibleMigrationStep,
} from '../steps'
import { SwitchPanel } from '../switch/SwitchPanel'

interface Props {
  migrationId: string
}

export default function MigrationDetailPage({ migrationId }: Props) {
  const {
    data: migration,
    isLoading,
    isError,
  } = useMerchantMigration(migrationId)

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-md)!"
      title="Stripe"
      header={migration ? <SourceMeta migration={migration} /> : undefined}
    >
      {isLoading ? (
        <Box padding="3xl" alignItems="center" justifyContent="center">
          <Spinner />
        </Box>
      ) : isError ? (
        <Alert
          variant="danger"
          title="We couldn't load this migration"
          description="Something went wrong. Please refresh the page and try again."
        />
      ) : !migration ? (
        <Text color="muted">This migration no longer exists.</Text>
      ) : (
        <MigrationLoaded migration={migration} />
      )}
    </DashboardBody>
  )
}

function SourceMeta({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const connected = migration.source_connected
  const stripeUserId = migration.source?.stripe_user_id as string | undefined
  const livemode = migration.source?.livemode as boolean | undefined
  return (
    <Box alignItems="center" columnGap="s">
      {stripeUserId && <Text color="muted">{stripeUserId}</Text>}
      <Status
        status={connected ? (livemode ? 'Live' : 'Test') : 'Not connected'}
        color="gray"
        size="small"
      />
    </Box>
  )
}

function MigrationLoaded({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const needsPan = migration.step === 'copy_cards'
  const pan = usePanTransfer(needsPan ? migration.id : '')
  const panCurrentStepKey = pan.data?.current_step_key ?? null

  if (needsPan && pan.isLoading) {
    return (
      <Box padding="3xl" alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    )
  }

  return (
    <Box as="section" flexDirection="column" rowGap="2xl">
      <MigrationStepper
        migration={migration}
        panCurrentStepKey={panCurrentStepKey}
      />
      <StepContent
        migration={migration}
        panCurrentStepKey={panCurrentStepKey}
      />
    </Box>
  )
}

function StepContent({
  migration,
  panCurrentStepKey,
}: {
  migration: schemas['MerchantMigration']
  panCurrentStepKey: string | null
}) {
  if (!migration.source_connected) {
    return (
      <Text color="muted">
        Connect your Stripe account to start the migration.
      </Text>
    )
  }
  const def = currentStepDef(migration, panCurrentStepKey)
  switch (visibleMigrationStep(migration, panCurrentStepKey)) {
    // The stepper shows a connected migration as assessing, but nothing is
    // staged until the first pre-check runs.
    case 'source_setup':
      return (
        <Box flexDirection="column" rowGap="l">
          <StepHeading def={def} />
          <PrecheckPanel migration={migration} />
        </Box>
      )
    case 'pre_check':
      return <ReviewTable migrationId={migration.id} />
    // No `StepHeading`: the handoff panel is its own heading.
    case 'create_catalog':
      return <ImportedStep migrationId={migration.id} />
    case 'copy_cards':
      return (
        <Box flexDirection="column" rowGap="l">
          <StepHeading def={def} />
          <PanTransferPanel
            migrationId={migration.id}
            sourceStripeAccountId={
              migration.source?.stripe_user_id as string | undefined
            }
          />
        </Box>
      )
    // The switch runs here, and stays reachable at cleanup so the merchant can
    // switch the ones an earlier run left on Stripe.
    case 'activate_subscriptions':
    case 'cleanup':
      return (
        <Box flexDirection="column" rowGap="l">
          {def && <StepHeading def={def} />}
          <SwitchPanel migrationId={migration.id} />
        </Box>
      )
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <StepHeading def={def} />
      <Text color="muted">
        {def === null
          ? 'This migration is complete.'
          : "This step is being rolled out. We'll keep this page up to date."}
      </Text>
    </Box>
  )
}

function StepHeading({ def }: { def: MigrationStepDef | null }) {
  if (def === null) {
    return null
  }
  const owner = OWNER_LABELS[def.owner]
  return (
    <Box flexDirection="column" rowGap="xs">
      <Box alignItems="center" columnGap="s">
        <Text variant="title" as="h3">
          {def.title}
        </Text>
        {owner && <Status status={owner} color="gray" size="small" />}
      </Box>
      <Text color="muted">{def.description}</Text>
    </Box>
  )
}
