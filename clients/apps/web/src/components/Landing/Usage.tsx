'use client'

import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

import { ConcentricDraw } from './graphics/ConcentricDraw'
import { GaugeSweep } from './graphics/GaugeSweep'
import { RadialSpinner } from './graphics/RadialSpinner'
import { SectionHeader } from './SectionHeader'

const LAYERS = [
  {
    id: '01',
    name: 'Measure the usage',
    desc: 'Every call, token, and second your users consume, recorded the moment it happens.',
  },
  {
    id: '02',
    name: 'Calculate the charge',
    desc: 'Raw events roll into priced units. Per seat, per token, tiered or hybrid. However you wish to price.',
  },
  {
    id: '03',
    name: 'Merchant of Record',
    desc: 'We take on all the liability. Sales tax, VAT & chargebacks land on our name, not yours.',
  },
]

export const Usage = () => (
  <div className="flex w-full flex-col gap-y-12 md:gap-y-16">
    <SectionHeader
      title="Powerful usage billing for modern software"
      description="Meter anything your product does. Compose it with subscriptions, seats, credits, and trials into whatever shape your pricing takes."
    />
    <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap="l">
      {LAYERS.map((l, i) => (
        <Box
          key={l.id}
          flexDirection="column"
          backgroundColor="background-secondary"
          padding="s"
        >
          <Box display="block" aspectRatio="1 / 1">
            {i === 0 && <RadialSpinner />}
            {i === 1 && <GaugeSweep />}
            {i === 2 && <ConcentricDraw />}
          </Box>
          <Box flexDirection="column" rowGap="xl" padding="2xl">
            <Text variant="heading-xs" as="h3">
              {l.name}
            </Text>
            <Box
              width="2rem"
              borderWidth={1}
              borderColor="border-primary"
              borderStyle="solid"
            />
            <Text variant="heading-xxs" color="muted">
              {l.desc}
            </Text>
          </Box>
        </Box>
      ))}
    </Grid>
  </div>
)
