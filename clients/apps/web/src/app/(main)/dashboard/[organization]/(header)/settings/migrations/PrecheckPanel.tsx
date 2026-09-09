'use client'

import {
  isActiveMigrationOperation,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, Spinner, Text, type TextColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export function PrecheckPanel({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const precheck = useRunMerchantMigrationPrecheck(migration.id)
  const operation = migration.operation
  const running = precheck.isPending || isActiveMigrationOperation(operation)
  const failed = operation?.status === 'failed'
  const stalled = operation?.stalled === true
  const error =
    (failed ? operation?.error : null) ||
    (stalled
      ? "The pre-check hasn't made progress. Try again to resume."
      : null) ||
    (precheck.isError
      ? "We couldn't start the pre-check. Please try again."
      : null)
  const errorTone: TextColor = stalled ? 'warning' : 'danger'

  return (
    <Box flexDirection="column" rowGap="l" marginTop="m">
      <Text variant="caption" color="muted">
        We&apos;ll read your Stripe products, prices, customers and
        subscriptions and check they can be imported. Nothing is changed in
        Stripe.
      </Text>

      {running && (
        <Box alignItems="center" columnGap="s">
          <Spinner />
          <Text variant="caption" color="muted">
            Reading your Stripe catalog…
          </Text>
        </Box>
      )}

      {error && !running && (
        <Text variant="caption" color={errorTone}>
          {error}
        </Text>
      )}

      <Box>
        <Button size="sm" onClick={() => precheck.mutate()} disabled={running}>
          {running
            ? 'Checking…'
            : failed || stalled
              ? 'Try again'
              : 'Run pre-check'}
        </Button>
      </Box>
    </Box>
  )
}
