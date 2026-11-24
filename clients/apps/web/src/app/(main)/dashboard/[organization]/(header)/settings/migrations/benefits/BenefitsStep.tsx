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
  const settled = migration.step === 'set_up_benefits' && !running && !failed
  const showForm = editing || failed || (!settled && !running)
  const benefits = useMigrationBenefits(
    migration.id,
    operation?.status,
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
          Set up benefits
        </Text>
        <Text color="muted">
          We found these in Lemon Squeezy. Polar creates them with the same
          settings and adds them to your products. You can edit them later from
          Benefits.
        </Text>
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
          benefits={[...(benefits.data?.items ?? [])]}
          failure={failed ? operation?.error : null}
          onDone={() => setEditing(false)}
        />
      ) : (
        <BenefitsReady
          migrationId={migration.id}
          created={(benefits.data?.items ?? []).filter((b) => b.benefit_id)}
          onEdit={() => setEditing(true)}
        />
      )}
    </Box>
  )
}

function BenefitsReady({
  migrationId,
  created,
  onEdit,
}: {
  migrationId: string
  created: schemas['MerchantMigrationBenefit'][]
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
        <Text color="muted">
          {created.length
            ? `${created.map((b) => b.description).join(', ')} ${
                created.length === 1 ? 'is' : 'are'
              } on your products. Subscribers keep their license key when you switch billing.`
            : 'No benefits were created. You can add them later from each product.'}
        </Text>
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
