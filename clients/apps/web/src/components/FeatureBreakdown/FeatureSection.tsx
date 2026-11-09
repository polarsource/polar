import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

export const FeatureSection = ({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) => (
  <Box flexDirection="column" gap="l" minWidth={0}>
    <Box justifyContent="between" alignItems="center" gap="m" minHeight={32}>
      <Text variant="heading-xxs">{title}</Text>
      {action}
    </Box>
    {children}
  </Box>
)
