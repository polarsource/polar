'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useMerchantMigration } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, Spinner, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { MigrationStepper } from '../MigrationStepper'
import { PrecheckPanel } from '../PrecheckPanel'
import { ReviewTable } from '../review/ReviewTable'
import { currentStepDef, MigrationStepDef, OWNER_LABELS } from '../steps'
import { StripeMark } from '../StripeMark'

interface Props {
  organization: schemas['Organization']
  migrationId: string
}

export default function MigrationDetailPage({
  organization,
  migrationId,
}: Props) {
  const {
    data: migration,
    isLoading,
    isError,
  } = useMerchantMigration(migrationId)
  const basePath = `/dashboard/${organization.slug}/settings/migrations`

  return (
    <DashboardBody title={null}>
      <Box flexDirection="column" rowGap="l">
        <Link href={basePath}>
          <Box
            alignItems="center"
            columnGap="xs"
            color={{ base: 'text-secondary', hover: 'text-primary' }}
            cursor={{ hover: 'pointer' }}
          >
            <ChevronLeft size={14} />
            <Text variant="caption" color="inherit">
              All migrations
            </Text>
          </Box>
        </Link>

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
          <Box as="section" flexDirection="column" rowGap="xl">
            <SourceHeader migration={migration} />
            <MigrationStepper migration={migration} />
            <StepContent migration={migration} />
          </Box>
        )}
      </Box>
    </DashboardBody>
  )
}

// The migration's source is the page's real subject, so it stands in for the
// title — one line, no hero banner.
function SourceHeader({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const connected = migration.source_connected
  const stripeUserId = migration.source?.stripe_user_id as string | undefined
  const livemode = migration.source?.livemode as boolean | undefined
  return (
    <Box alignItems="center" columnGap="s">
      <StripeMark size={26} />
      <Text variant="heading-xs" as="h1">
        Stripe
      </Text>
      {stripeUserId && (
        <Text variant="caption" color="muted" monospace>
          {stripeUserId}
        </Text>
      )}
      <Status
        status={connected ? (livemode ? 'Live' : 'Test') : 'Not connected'}
        color="gray"
        size="small"
      />
    </Box>
  )
}

function StepContent({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  if (!migration.source_connected) {
    return (
      <Text variant="caption" color="muted">
        Connect your Stripe account to start the migration.
      </Text>
    )
  }
  const def = currentStepDef(migration)
  // The stepper shows a connected migration as assessing, but nothing is staged
  // until the first pre-check runs.
  if (migration.step === 'source_setup') {
    return (
      <Box flexDirection="column" rowGap="l">
        <StepHeading def={def} />
        <PrecheckPanel migrationId={migration.id} />
      </Box>
    )
  }
  // `steps.ts` owns which backend steps the assessment covers.
  if (def?.key === 'assessment') {
    return <ReviewTable migrationId={migration.id} />
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <StepHeading def={def} />
      <Text variant="caption" color="muted">
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
        <Text variant="heading-xs" as="h3">
          {def.title}
        </Text>
        {owner && <Status status={owner} color="gray" size="small" />}
      </Box>
      <Text variant="caption" color="muted">
        {def.description}
      </Text>
    </Box>
  )
}
