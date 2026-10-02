import { Grid } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ComponentType } from 'react'
import { Chapter } from '../Landing/Chapter'
import { Compass } from '../Landing/graphics/Compass'
import { ConcentricDraw } from '../Landing/graphics/ConcentricDraw'
import { CycleArrow } from '../Landing/graphics/CycleArrow'
import { GaugeSweep } from '../Landing/graphics/GaugeSweep'
import { LinkedRings } from '../Landing/graphics/LinkedRings'
import { OrbitingSpheres } from '../Landing/graphics/OrbitingSpheres'
import { RadialSpinner } from '../Landing/graphics/RadialSpinner'
import { SteppedRadial } from '../Landing/graphics/SteppedRadial'
import { VennCluster } from '../Landing/graphics/VennCluster'
import { brandSections } from './brand'

const illustrations: { name: string; Graphic: ComponentType }[] = [
  { name: 'Radial Spinner', Graphic: RadialSpinner },
  { name: 'Stepped Radial', Graphic: SteppedRadial },
  { name: 'Compass', Graphic: Compass },
  { name: 'Cycle', Graphic: CycleArrow },
  { name: 'Linked Rings', Graphic: LinkedRings },
  { name: 'Orbit', Graphic: OrbitingSpheres },
  { name: 'Cluster', Graphic: VennCluster },
  { name: 'Gauge', Graphic: GaugeSweep },
  { name: 'Concentric', Graphic: ConcentricDraw },
]

export function IllustrationSection() {
  return (
    <Chapter
      id={brandSections[3].id}
      index={brandSections[3].index}
      name={brandSections[3].label}
      title="A geometric system in motion"
      subtitle="Clear primitives, thin strokes"
      description="A family of line illustrations that stays quiet, exact and legible at any size."
    >
      <Grid
        templateColumns={{
          base: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        }}
        gap="l"
      >
        {illustrations.map(({ name, Graphic }) => (
          <Box
            key={name}
            padding={{ base: 'xl', md: '3xl' }}
            backgroundColor="background-secondary"
          >
            <Box display="block" width="100%" aspectRatio="1 / 1">
              <Graphic />
            </Box>
          </Box>
        ))}
      </Grid>
    </Chapter>
  )
}
