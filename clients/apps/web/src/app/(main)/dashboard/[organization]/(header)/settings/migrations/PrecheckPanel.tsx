'use client'

import { useRunMerchantMigrationPrecheck } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PrecheckSummary } from './PrecheckSummary'

export function PrecheckPanel({ migrationId }: { migrationId: string }) {
  const precheck = useRunMerchantMigrationPrecheck(migrationId)
  const report = precheck.data

  return (
    <Box flexDirection="column" rowGap="l" marginTop="m">
      {report ? (
        <PrecheckResult report={report} migrationId={migrationId} />
      ) : (
        <Text variant="caption" color="muted">
          We&apos;ll read your Stripe products, prices, customers and
          subscriptions and check they can be imported. Nothing is changed in
          Stripe.
        </Text>
      )}

      {precheck.isError && (
        <Text variant="caption" color="danger">
          We couldn&apos;t complete the pre-check. Please try again.
        </Text>
      )}

      <Box>
        <Button
          size="sm"
          variant={report ? 'ghost' : 'default'}
          onClick={() => precheck.mutate()}
          disabled={precheck.isPending}
        >
          {precheck.isPending
            ? 'Checking…'
            : report
              ? 'Run again'
              : 'Run pre-check'}
        </Button>
      </Box>
    </Box>
  )
}

function PrecheckResult({
  report,
  migrationId,
}: {
  report: schemas['PrecheckReport']
  migrationId: string
}) {
  const blockers = report.issues.filter((issue) => issue.level === 'blocker')

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" columnGap="s">
        <Status
          status={
            report.can_start
              ? 'Ready to import'
              : `${blockers.length} blocker${blockers.length === 1 ? '' : 's'} to resolve`
          }
          color={report.can_start ? 'green' : 'red'}
          size="small"
        />
        <Text variant="caption" color="muted">
          Read from Stripe · nothing changed
        </Text>
      </Box>

      {blockers.length > 0 && (
        <Box as="ul" flexDirection="column" rowGap="xs">
          {blockers.map((issue, index) => (
            <Box as="li" key={`${issue.code}-${index}`}>
              <Text variant="caption" color="danger">
                {issue.message}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <PrecheckSummary migrationId={migrationId} report={report} />
    </Box>
  )
}
