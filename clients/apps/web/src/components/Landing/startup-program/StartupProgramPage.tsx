'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Logotypes } from '../Logotypes'
import { Section } from '../Section'
import { StartupProgramFAQ } from './StartupProgramFAQ'
import { StartupProgramForm } from './StartupProgramForm'
import { StartupProgramHero } from './StartupProgramHero'
import { StartupLogo } from './StartupLogo'
import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { VolumetricSlices } from '../graphics/VolumetricSlices'

export const StartupProgramPage = () => {
  return (
    <Box display="flex" flexDirection="column">
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
        <Text as="p" variant="heading-xxs">
          An entire year on our most generous plan. For free.
        </Text>
      </Box>

      <Section>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          rowGap="xl"
        >
          <Logotypes />
        </Box>
      </Section>

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
