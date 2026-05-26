'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Section } from '../Section'
import { StartupProgramFAQ } from './StartupProgramFAQ'
import { StartupProgramForm } from './StartupProgramForm'
import { StartupProgramHero } from './StartupProgramHero'
import { VolumetricSlices } from '../graphics/VolumetricSlices'

export const StartupProgramPage = () => {
  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Box
        display="flex"
        alignItems="center"
        flexDirection="column"
        paddingVertical="2xl"
        rowGap="2xl"
      >
        <Box width="16rem" display="flex" aspectRatio="1 / 1">
          <VolumetricSlices />
        </Box>
        <Text as="h1" variant="heading-xl">
          Startup Program
        </Text>
        <Text as="p" variant="heading-xxs" align="center">
          An entire year on our most generous plan. For free.
        </Text>
      </Box>

      <Box width="4rem" marginTop="2xl" display="flex" />

      <Section>
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
          gap={{ base: 'xl', md: '3xl' }}
        >
          <StartupProgramHero />
          <StartupProgramForm />
        </Box>
      </Section>

      <Section>
        <StartupProgramFAQ />
      </Section>
    </Box>
  )
}
