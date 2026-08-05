import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: ReactNode
  description: ReactNode
  align?: 'start' | 'center'
}

/**
 * The shared landing-section header: title on the left, supporting
 * description on the right. The two halves share the row equally and sit
 * vertically centered (pass `align="start"` to top-align, e.g. next to a
 * multi-paragraph description), stacking to a single column below `xl`. The
 * title's text width is capped so it wraps to roughly two lines, keeping its
 * vertical weight in balance with the description. A string description gets
 * the standard muted styling; pass a node to fully control the right column.
 */
export const SectionHeader = ({ title, description }: SectionHeaderProps) => (
  <Box
    flexDirection={{ base: 'column', xl: 'row' }}
    alignItems="start"
    rowGap="l"
    columnGap="4xl"
  >
    <Box flex={1}>
      <Box display="block" maxWidth={{ base: '100%', xl: '32rem' }}>
        <Text variant="heading-l" as="h2" wrap="balance">
          {title}
        </Text>
      </Box>
    </Box>
    <Box display="block" flex={1}>
      {typeof description === 'string' ? (
        <Text variant="heading-xs" color="muted" wrap="pretty">
          {description}
        </Text>
      ) : (
        description
      )}
    </Box>
  </Box>
)
