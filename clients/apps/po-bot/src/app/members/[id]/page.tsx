import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'

export default function MemberPage() {
  return (
    <Box
      height="100%"
      alignItems="center"
      justifyContent="center"
      padding="2xl"
    >
      <Text color="muted" align="center">
        Pick an agent on the left, or create one.
      </Text>
    </Box>
  )
}
