import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ComponentType } from 'react'
import { Chapter } from '../Chapter'
import { Compass } from '../graphics/Compass'
import { GaugeSweep } from '../graphics/GaugeSweep'
import { RadialSpinner } from '../graphics/RadialSpinner'
import { SteppedRadial } from '../graphics/SteppedRadial'

interface Step {
  title: string
  desc: string
  Graphic: ComponentType
}

const STEPS: Step[] = [
  {
    title: 'Measure the usage',
    desc: 'Every call, token and GPU second your users consume, recorded the moment it happens.',
    Graphic: RadialSpinner,
  },
  {
    title: 'Aggregate into meters',
    desc: 'Raw events roll up into a live meter per customer. No batch jobs, no lag.',
    Graphic: GaugeSweep,
  },
  {
    title: 'Calculate the charge',
    desc: 'Meters turn into priced units. Per token, per seat, tiered or hybrid. However you wish to price.',
    Graphic: Compass,
  },
  {
    title: 'Bill it automatically',
    desc: 'Usage lands on the invoice and settles at the end of every cycle, without any manual reconciliation.',
    Graphic: SteppedRadial,
  },
]

export const Meter = () => (
  <Chapter
    index="01"
    name="Meter everything"
    title="Every token becomes revenue"
    subtitle="the moment your model streams it"
    description="Tokens, agent runs and GPU seconds flow through live meters and land on the invoice, priced however you sell."
  >
    <Grid
      templateColumns={{
        base: '1fr',
        md: 'repeat(2, 1fr)',
        xl: 'repeat(4, 1fr)',
      }}
      gap="l"
    >
      {STEPS.map(({ title, desc, Graphic }) => (
        <Box
          key={title}
          height="100%"
          flexDirection="column"
          justifyContent="between"
          rowGap="3xl"
          padding="3xl"
          backgroundColor="background-secondary"
        >
          <Box display="block" aspectRatio="1 / 1">
            <Graphic />
          </Box>
          <Box flexDirection="column" rowGap="l">
            <Text variant="heading-xs" as="h3">
              {title}
            </Text>

            <Text variant="heading-xxs" color="muted" wrap="pretty">
              {desc}
            </Text>
          </Box>
        </Box>
      ))}
    </Grid>
  </Chapter>
)
