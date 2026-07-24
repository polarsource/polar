import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

interface SettingsPanelProps {
  title: string
  description: string
  action?: ReactNode
  children?: ReactNode
}

export const SettingsPanel = ({
  title,
  description,
  action,
  children,
}: SettingsPanelProps) => {
  return (
    <Box
      flexDirection="column"
      rowGap="xl"
      borderRadius="xl"
      backgroundColor="background-secondary"
      padding="2xl"
    >
      <Box justifyContent="between" alignItems="start" columnGap="l">
        <Box flexDirection="column" rowGap="s">
          <Text variant="heading-xs" as="h3">
            {title}
          </Text>
          <Text color="muted">{description}</Text>
        </Box>
        {action}
      </Box>

      {children && (
        <>
          <Box
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          />
          <Box flexDirection="column" rowGap="l">
            {children}
          </Box>
        </>
      )}
    </Box>
  )
}
