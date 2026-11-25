import { LockOutlined } from '@polar-sh/orbit/icons'
import { Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const ManagedAsCodeBadge = () => (
  <Pill color="gray">
    <LockOutlined fontSize="inherit" />
    <span>Managed in code</span>
  </Pill>
)

export const ManagedAsCodeHint = ({
  resource,
  align = 'center',
}: {
  resource: string
  align?: 'start' | 'center'
}) => (
  <Box flexDirection="column" alignItems={align} rowGap="s">
    <ManagedAsCodeBadge />
    <Text color="muted" align={align === 'start' ? 'left' : 'center'}>
      Add {resource} to your config.
    </Text>
  </Box>
)
