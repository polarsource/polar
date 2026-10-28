import { schemas } from '@polar-sh/client'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { StripeMark } from './StripeMark'
import { currentPosition, MIGRATION_STEPS } from './steps'

function summary(migration: schemas['MerchantMigration']): string {
  if (!migration.source_connected) {
    return 'Connect Stripe to begin'
  }
  if (migration.step === 'closed') {
    return 'Closed after 90 days without activity'
  }
  const position = currentPosition(migration)
  if (position.kind === 'completed') {
    return 'Completed'
  }
  const def = MIGRATION_STEPS[position.index]
  return `Step ${position.index + 1} of ${MIGRATION_STEPS.length} · ${def.title}`
}

export function MigrationRow({
  migration,
  href,
}: {
  migration: schemas['MerchantMigration']
  href: string
}) {
  const connected = migration.source_connected
  const stripeUserId = migration.source?.stripe_user_id as string | undefined

  return (
    <Link href={href}>
      <Box
        alignItems="center"
        columnGap="l"
        paddingHorizontal="xl"
        paddingVertical="l"
        backgroundColor={{ hover: 'background-card' }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <StripeMark size={32} />
        <Box flexDirection="column" rowGap="xs" flex={1} minWidth={0}>
          <Text variant="title">Stripe</Text>
          <Text variant="caption" color="muted">
            {connected && stripeUserId ? (
              stripeUserId
            ) : (
              <>
                Started <FormattedDateTime datetime={migration.created_at} />
              </>
            )}
            {' · '}
            {summary(migration)}
          </Text>
        </Box>
        <Box alignItems="center" columnGap="s" flexShrink={0}>
          <Status
            status={connected ? 'Connected' : 'Not connected'}
            color={connected ? 'green' : 'gray'}
            size="small"
          />
          <Text color="muted">
            <ChevronRight size={16} aria-hidden="true" />
          </Text>
        </Box>
      </Box>
    </Link>
  )
}
