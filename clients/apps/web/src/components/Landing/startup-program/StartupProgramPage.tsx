'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Logotypes } from '../Logotypes'
import { Section } from '../Section'
import { StartupProgramForm } from './StartupProgramForm'
import { StartupProgramHero } from './StartupProgramHero'

const FEATURES = [
  {
    title: 'Payments & Usage-based Billing',
    description:
      'Charge for usage, subscriptions, seats and credits from one platform. Polar handles invoicing, dunning and global tax compliance.',
  },
  {
    title: 'Cost Insights',
    description:
      'Real-time profit, LTV, and per-customer margin. Understand which customers and products actually make money as you scale.',
  },
]

export const StartupProgramPage = () => {
  return (
    <Box display="flex" flexDirection="column">
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
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          rowGap="xl"
        >
          <Text variant="heading-xxs">
            Join a community of startups shaping what&apos;s next
          </Text>
          <Logotypes />
        </Box>
      </Section>
    </Box>
  )
}
