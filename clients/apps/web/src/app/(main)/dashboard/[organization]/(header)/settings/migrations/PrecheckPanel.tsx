'use client'

import {
  isActiveMigrationOperation,
  useRunMerchantMigrationPrecheck,
} from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CATALOG_READ_DURATION, CATALOG_READ_STALLED } from './catalogReadCopy'

export function PrecheckPanel({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const precheck = useRunMerchantMigrationPrecheck(migration.id)
  const stalled = !precheck.isPending && migration.operation?.stalled === true
  const running =
    precheck.isPending ||
    stalled ||
    isActiveMigrationOperation(migration.operation)
  const failed = migration.operation?.status === 'failed'
  const error =
    (failed ? migration.operation?.error : null) ||
    (precheck.isError
      ? "We couldn't start the pre-check. Please try again."
      : null)
  // Creating a migration starts the pre-check, so there's nothing to click
  // while it runs.
  const action = stalled
    ? 'Start again'
    : running
      ? null
      : failed
        ? 'Try again'
        : 'Run pre-check'

  return (
    <Box flexDirection="column" rowGap="l" marginTop="m">
      <Text variant="caption" color="muted">
        We&apos;ll read your Stripe products, prices, coupons, customers and
        subscriptions and check they can be imported. Nothing is changed in
        Stripe.
      </Text>

      {running && (
        <Box flexDirection="column" rowGap="xs">
          <Box alignItems="center" columnGap="s">
            <Spinner />
            <Text variant="caption" color="muted">
              Reading your Stripe catalog…
            </Text>
          </Box>
          <Text variant="caption" color="muted">
            {stalled ? CATALOG_READ_STALLED : CATALOG_READ_DURATION}
          </Text>
        </Box>
      )}

      {error && (!running || stalled) && (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      )}

      {action && (
        <Box>
          <Button size="sm" onClick={() => precheck.mutate()}>
            {action}
          </Button>
        </Box>
      )}
    </Box>
  )
}
