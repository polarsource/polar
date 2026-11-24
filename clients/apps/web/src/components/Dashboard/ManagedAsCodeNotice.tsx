import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { LockOutlined } from '@polar-sh/orbit/icons'

export const ManagedAsCodeNotice = () => (
  <Box
    height={40}
    paddingHorizontal="l"
    columnGap="s"
    alignItems="center"
    borderRadius="full"
    backgroundColor="background-card"
    color="text-secondary"
    cursor="default"
    userSelect="none"
  >
    <LockOutlined fontSize="inherit" aria-hidden />
    <Text as="span" variant="title" color="inherit" wrap="nowrap">
      Managed in code
    </Text>
  </Box>
)
