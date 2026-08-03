'use client'

import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

import { ConcentricDraw } from './graphics/ConcentricDraw'
import { GaugeSweep } from './graphics/GaugeSweep'
import { RadialSpinner } from './graphics/RadialSpinner'

const LAYERS = [
  {
    id: '01',
    name: 'We measure the usage',
    desc: 'Every call, token, and second your users consume, recorded the moment it happens. No pipeline to run, nothing to reconcile.',
  },
  {
    id: '02',
    name: 'We calculate the charge',
    desc: 'Raw events roll into priced units. Per seat, per token, tiered, hybrid. The math follows when you change your mind mid-cycle.',
  },
  {
    id: '03',
    name: 'We take on the liability',
    desc: "We're the merchant of record. Sales tax, VAT, and chargebacks land on our name, not yours.",
  },
]

export const Usage = () => (
  <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap="l">
    {LAYERS.map((l, i) => (
      <Box
        key={l.id}
        flexDirection="column"
        backgroundColor="background-secondary"
        padding="s"
      >
        <Box flexDirection="column" rowGap="s" padding="2xl">
          <Text variant="label" as="h3" color="muted" monospace>
            FIG. {l.id}
          </Text>
        </Box>
        <Box display="block" aspectRatio="1 / 1">
          {i === 0 && <RadialSpinner />}
          {i === 1 && <GaugeSweep />}
          {i === 2 && <ConcentricDraw />}
        </Box>
        <Box flexDirection="column" rowGap="s" padding="2xl">
          <Text variant="heading-xs" as="h3">
            {l.name}
          </Text>
          <Text variant="body" color="muted">
            {l.desc}
          </Text>
        </Box>
      </Box>
    ))}
  </Grid>
)
