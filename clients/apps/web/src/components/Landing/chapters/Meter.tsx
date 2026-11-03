import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Chapter'
import { GraphicCardGrid, type GraphicCardProps } from '../FeatureCards'
import { MeterStream } from '../MeterStream'
import { GaugeSweep } from '../graphics/GaugeSweep'
import { RadialSpinner } from '../graphics/RadialSpinner'
import { SteppedRadial } from '../graphics/SteppedRadial'

const STEPS: GraphicCardProps[] = [
  {
    title: 'Measure the usage',
    desc: 'Every call, token and GPU second your users consume, recorded the moment it happens.',
    href: '/features/event-ingestion',
    Graphic: RadialSpinner,
  },
  {
    title: 'Aggregate into meters',
    desc: 'Raw events roll up into a live meter for every customer, updated in real time. No batch jobs, no lag.',
    href: '/features/meters',
    Graphic: GaugeSweep,
  },
  {
    title: 'Bill it automatically',
    desc: 'Usage lands on the invoice and settles at the end of every cycle, without any manual reconciliation.',
    href: '/features/usage-billing',
    Graphic: SteppedRadial,
  },
]

export const Meter = () => (
  <Chapter
    id="meter"
    name="01 Meter anything"
    title="Every token becomes revenue"
    subtitle="the moment your model streams it"
    description="Tokens, agent runs and GPU seconds flow through live meters and land on the invoice, priced however you sell."
  >
    <Box flexDirection="column" rowGap="4xl">
      <MeterStream />
      <GraphicCardGrid cards={STEPS} />
    </Box>
  </Chapter>
)
