'use client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

import { RadialSpinner } from './graphics/RadialSpinner'
import { GaugeSweep } from './graphics/GaugeSweep'
import { OrbitingSpheres } from './graphics/OrbitingSpheres'

const LAYERS = [
  {
    id: '01',
    name: 'Ingest',
    desc: 'Ingest usage & inference on behalf of your users.',
  },
  {
    id: '02',
    name: 'Aggregate',
    desc: 'Transform raw signals into billable usage.',
  },
  {
    id: '03',
    name: 'Charge',
    desc: 'Generate invoices and collect payment automatically.',
  },
]

export const Usage = () => (
  <Box
    display="grid"
    gridTemplateColumns={{
      base: 'repeat(1, minmax(0, 1fr))',
      md: 'repeat(3, minmax(0, 1fr))',
    }}
    gap="l"
  >
    {LAYERS.map((l, i) => (
      <Box
        backgroundColor="background-secondary"
        display="flex"
        flexDirection="column"
        key={l.id}
      >
        {/* Graphic */}
        <Box aspectRatio="1 / 1">
          {i === 0 && <RadialSpinner />}
          {i === 1 && <GaugeSweep />}
          {i === 2 && <OrbitingSpheres />}
        </Box>
        {/* Label */}
        <Box
          display="flex"
          flexDirection="column"
          paddingHorizontal="2xl"
          paddingVertical="2xl"
        >
          <Box display="flex" flexDirection="column" gap="l">
            <Box as="span" color="text-primary" className="text-2xl">
              {l.id} — {l.name}
            </Box>
            <Text as="span" variant="heading-xxs" color="muted">
              {l.desc}
            </Text>
          </Box>
        </Box>
      </Box>
    ))}
  </Box>
)
