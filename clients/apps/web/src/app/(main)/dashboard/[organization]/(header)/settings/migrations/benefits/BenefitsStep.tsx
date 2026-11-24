'use client'

import {
  isActiveMigrationOperation,
  useMigrationBenefits,
  useStartPanTransfer,
} from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, ButtonGroup, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { ImportedStep } from '../ImportedStep'
import { plural } from '../review/importSummary'
import { BENEFITS_STEP } from '../steps'
import { BenefitsForm } from './BenefitsForm'

// Lemon Squeezy only. The catalog receipt hands off to this step instead of
// the card move, so the step covers both `create_catalog` and
// `set_up_benefits`.
export function BenefitsStep({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const [editing, setEditing] = useState(false)
  const operation = migration.operation
  const running =
    operation?.kind === 'benefits' && isActiveMigrationOperation(operation)
  const failed = operation?.kind === 'benefits' && operation.status === 'failed'
  const showForm = editing || failed
  const benefits = useMigrationBenefits(
    migration.id,
    operation,
    migration.step === 'set_up_benefits' || editing,
  )

  if (migration.step === 'create_catalog' && !editing) {
    return (
      <ImportedStep
        migrationId={migration.id}
        onSetUpBenefits={() => setEditing(true)}
      />
    )
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="title" as="h3">
          {BENEFITS_STEP.title}
        </Text>
        <Text color="muted">{BENEFITS_STEP.description}</Text>
      </Box>
      {running ? (
        <Alert
          loading
          title="Setting up benefits"
          description="Polar is creating your benefits and copying files from Lemon Squeezy. You can leave this page."
        />
      ) : benefits.isLoading ? (
        <Box padding="2xl" justifyContent="center">
          <Spinner />
        </Box>
      ) : benefits.isError ? (
        <Alert
          variant="danger"
          title="We couldn't read your Lemon Squeezy store"
          description="Please refresh the page and try again."
        />
      ) : showForm ? (
        <BenefitsForm
          migrationId={migration.id}
          benefits={benefits.data?.items ?? []}
          failure={failed ? operation?.error : null}
          onDone={() => setEditing(false)}
        />
      ) : (
        <BenefitsReady
          migrationId={migration.id}
          created={(benefits.data?.items ?? []).filter((b) => b.benefit_id)}
          pastPurchasesGranted={!!benefits.data?.past_purchases_granted}
          onEdit={() => setEditing(true)}
        />
      )}
    </Box>
  )
}

function BenefitsReady({
  migrationId,
  created,
  pastPurchasesGranted,
  onEdit,
}: {
  migrationId: string
  created: schemas['MerchantMigrationBenefit'][]
  pastPurchasesGranted: boolean
  onEdit: () => void
}) {
  const start = useStartPanTransfer(migrationId)
  return (
    <Box
      flexDirection="column"
      padding="xl"
      rowGap="l"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      <Box flexDirection="column" rowGap="xs">
        <Text variant="title" as="h3">
          {created.length ? 'Benefits created' : 'Benefits skipped'}
        </Text>
        {created.length ? (
          <>
            <Text color="muted">
              {plural(created.length, 'benefit')}{' '}
              {created.length === 1 ? 'is' : 'are'} on Polar. You can edit them
              from Benefits.
            </Text>
            {created.some((benefit) => benefit.type === 'license_keys') && (
              <Text color="muted">
                Subscribers keep their license key when you switch billing.
              </Text>
            )}
            {pastPurchasesGranted && (
              <Text color="muted">
                Past one-time buyers already have their license keys and files.
                They find them in their customer portal.
              </Text>
            )}
          </>
        ) : (
          <Text color="muted">
            No benefits were created. You can add them later from each product.
          </Text>
        )}
      </Box>
      <Box
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      />
      <Box flexDirection="column" rowGap="xs">
        <Text variant="title" as="h3">
          Next: move saved cards
        </Text>
        <Text color="muted">
          Your customers&apos; cards are still with Lemon Squeezy. Moving them
          lets Polar charge them. This is a checklist. You can leave and come
          back.
        </Text>
      </Box>
      {start.error && (
        <Text variant="caption" color="danger" role="alert">
          {start.error.message}
        </Text>
      )}
      <ButtonGroup
        size="sm"
        actions={[
          {
            text: start.isPending ? 'Starting…' : 'Start moving cards',
            disabled: start.isPending,
            onClick: () => start.mutate(),
          },
          { text: 'Edit benefits', onClick: onEdit },
        ]}
      />
    </Box>
  )
}
