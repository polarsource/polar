import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: ReactNode
  description: ReactNode
}

/**
 * The shared landing-section header: title on the left, supporting
 * description on the right. The two halves share the row equally and sit
 * vertically centered, stacking to a single column below `xl`. The title's
 * text width is capped so it wraps to roughly two lines, keeping its
 * vertical weight in balance with the description.
 */
export const SectionHeader = ({ title, description }: SectionHeaderProps) => (
  <Box
    display="flex"
    flexDirection={{ base: 'column', xl: 'row' }}
    alignItems={{ base: 'start', xl: 'center' }}
    rowGap="l"
    columnGap="4xl"
  >
    <Box flex={1} display="flex">
      <Box maxWidth={{ base: '100%', xl: '32rem' }}>
        <Text variant="heading-l" as="h2" wrap="balance">
          {title}
        </Text>
      </Box>
    </Box>
    <Box flex={1}>
      <Text variant="heading-xs" color="muted" wrap="pretty">
        {description}
      </Text>
    </Box>
  </Box>
)
