'use client'

import {
  isActiveMigrationOperation,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export function PrecheckPanel({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const precheck = useRunMerchantMigrationPrecheck(migration.id)
  const running =
    precheck.isPending || isActiveMigrationOperation(migration.operation)
  const failed = migration.operation?.status === 'failed'
  const error =
    (failed ? migration.operation?.error : null) ||
    (precheck.isError
      ? "We couldn't start the pre-check. Please try again."
      : null)

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
        <Text variant="caption" color="danger">
          {error}
        </Text>
      )}

      <Box>
        <Button size="sm" onClick={() => precheck.mutate()} disabled={running}>
          {running ? 'Checking…' : failed ? 'Try again' : 'Run pre-check'}
        </Button>
      </Box>
    </Box>
  )
}
