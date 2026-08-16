'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { TextRings } from './graphics/TextRings'

export const ClosingCta = () => (
  <Box
    as="section"
    width="100%"
    flexDirection="column"
    alignItems="center"
    rowGap="3xl"
    paddingVertical={{ base: '4xl', md: '5xl' }}
    marginTop={{ base: 'none', md: '2xl' }}
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Box display="block" width="100%" maxWidth="50%">
      <TextRings />
    </Box>
    <Box
      flexDirection="column"
      alignItems="center"
      rowGap="xs"
      textAlign="center"
    >
      <Text variant="heading-l" as="h2" wrap="balance">
        From usage to revenue
      </Text>
      <Text variant="heading-l" as="p" color="muted" wrap="balance">
        Integrate in an afternoon
      </Text>
    </Box>
    <GetStartedButton size="lg" text="Get Started" />
  </Box>
)
