import { schemas } from '@polar-sh/client'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { StripeMark } from './StripeMark'
import { MIGRATION_STEPS, currentStepKey, stepPosition } from './steps'

function summary(migration: schemas['MerchantMigration']): string {
  if (!migration.source_connected) {
    return 'Connect Stripe to begin'
  }
  const index = stepPosition(currentStepKey(migration))
  const def = MIGRATION_STEPS[index]
  if (!def) {
    return 'Completed'
  }
  return `Step ${index + 1} of ${MIGRATION_STEPS.length} · ${def.title}`
}

export function MigrationCard({
  migration,
  href,
}: {
  migration: schemas['MerchantMigration']
  href: string
}) {
  const connected = migration.source_connected

  return (
    <Link href={href}>
      <Box
        flexDirection="column"
        rowGap="l"
        height="100%"
        padding="xl"
        borderRadius="l"
        backgroundColor="background-card"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        boxShadow={{ base: 'none', hover: 's' }}
        transform={{ hover: 'translateY(-2px)' }}
        transitionProperty="common"
        transitionDuration="fast"
        ease="decelerate"
        cursor={{ hover: 'pointer' }}
      >
        <Box alignItems="center" justifyContent="between">
          <StripeMark size={40} />
          <Status
            status={connected ? 'Connected' : 'Not connected'}
            color={connected ? 'green' : 'gray'}
            size="small"
          />
        </Box>

        <Box flexDirection="column" rowGap="xs">
          <Text variant="body">Stripe</Text>
          {connected && migration.source?.stripe_user_id ? (
            <Text variant="caption" color="muted" monospace>
              {migration.source.stripe_user_id as string}
            </Text>
          ) : (
            <Text variant="caption" color="muted">
              Started <FormattedDateTime datetime={migration.created_at} />
            </Text>
          )}
        </Box>

        <Box
          marginTop="auto"
          paddingTop="m"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-secondary"
        >
          <Text variant="caption" color="muted">
            {summary(migration)}
          </Text>
        </Box>
      </Box>
    </Link>
  )
}
