import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

/** A muted heading over a section of a pane, with an optional right-hand note. */
export const SectionLabel = ({
  children,
  aside,
}: {
  children: React.ReactNode
  aside?: React.ReactNode
}) => (
  <Box
    justifyContent="between"
    alignItems="baseline"
    columnGap="s"
    paddingHorizontal="xs"
  >
    <Text variant="caption" color="muted" as="h2">
      {children}
    </Text>
    {aside}
  </Box>
)
