'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MIGRATION_SETTINGS_SECTIONS } from './migrationSettingsSections'

export function MigrationSettingsPanel({
  migrationId,
}: {
  migrationId: string
}) {
  return (
    <Box flexDirection="column" rowGap="xl">
      {MIGRATION_SETTINGS_SECTIONS.map(
        ({ key, title, description, Component }) => (
          <Box key={key} as="section" flexDirection="column" rowGap="l">
            <Box flexDirection="column" rowGap="xs">
              <Text variant="heading-xxs" as="h3">
                {title}
              </Text>
              <Text variant="caption" color="muted">
                {description}
              </Text>
            </Box>
            <Component migrationId={migrationId} />
          </Box>
        ),
      )}
    </Box>
  )
}
