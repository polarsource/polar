// PROTOTYPE: small pieces the variants share. Throwaway.
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

export const Loading = () => (
  <Box flexGrow={1} alignItems="center" justifyContent="center">
    <Text color="muted">Loading every version…</Text>
  </Box>
)
