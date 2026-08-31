'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'

export const SettingsBlock = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) => (
  <Box flexDirection="column" rowGap="2xl">
    <Box flexDirection="column" rowGap="xs">
      <Text variant="heading-xs">{title}</Text>
      {description ? (
        <Text variant="heading-xxs" color="muted">
          {description}
        </Text>
      ) : null}
    </Box>
    <Box flexDirection="column" rowGap="xl">
      {children}
    </Box>
  </Box>
)
