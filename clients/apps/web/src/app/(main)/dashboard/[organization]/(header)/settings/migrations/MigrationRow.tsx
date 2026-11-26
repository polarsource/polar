import { schemas } from '@polar-sh/client'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ChevronRight } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { SourceMark } from './SourceMark'
import { SOURCE_LABELS, sourceAccountLabel } from './sources'
import { useBenefitsOnly } from './benefitsOnly'
import { currentPosition, migrationSteps } from './steps'

function summary(
  migration: schemas['MerchantMigration'],
  benefitsOnly: boolean,
): string {
  if (!migration.source_connected) {
    return `Connect ${SOURCE_LABELS[migration.source_platform]} to begin`
  }
  if (migration.step === 'closed') {
    return 'Closed after 90 days without activity'
  }
  const position = currentPosition(migration, null, benefitsOnly)
  if (position.kind === 'completed') {
    return 'Completed'
  }
  const steps = migrationSteps(migration.source_platform, benefitsOnly)
  const def = steps[position.index]
  return `Step ${position.index + 1} of ${steps.length} · ${def.title}`
}

export function MigrationRow({
  migration,
  href,
}: {
  migration: schemas['MerchantMigration']
  href: string
}) {
  const connected = migration.source_connected
  const accountLabel = sourceAccountLabel(migration)
  const benefitsOnly = useBenefitsOnly(migration) ?? false

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
        <SourceMark source={migration.source_platform} size={32} />
        <Box flexDirection="column" rowGap="xs" flex={1} minWidth={0}>
          <Text variant="title">
            {SOURCE_LABELS[migration.source_platform]}
          </Text>
          <Text variant="caption" color="muted">
            {connected && accountLabel ? (
              accountLabel
            ) : (
              <>
                Started <FormattedDateTime datetime={migration.created_at} />
              </>
            )}
            {' · '}
            {summary(migration, benefitsOnly)}
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
