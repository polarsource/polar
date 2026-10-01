'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Fragment } from 'react'
import { MIGRATION_SETTINGS_SECTIONS } from './migrationSettingsSections'

export function MigrationSettingsPanel({
  migrationId,
  onBusyChange,
}: {
  migrationId: string
  onBusyChange: (key: string, busy: boolean) => void
}) {
  return (
    <Box flexDirection="column" rowGap="xl">
      {MIGRATION_SETTINGS_SECTIONS.map(
        ({ key, title, description, Component }, index) => (
          <Fragment key={key}>
            {index > 0 ? (
              <Box height={1} backgroundColor="background-secondary" />
            ) : null}
            <Box as="section" flexDirection="column" rowGap="l">
              <Box flexDirection="column" rowGap="xs">
                <Text variant="heading-xxs" as="h3">
                  {title}
                </Text>
                <Text variant="caption" color="muted">
                  {description}
                </Text>
              </Box>
              <Component
                migrationId={migrationId}
                onBusyChange={(busy) => onBusyChange(key, busy)}
              />
            </Box>
          </Fragment>
        ),
      )}
    </Box>
  )
}
