import React from 'react'
import { ConcentricDraw } from '../Landing/graphics/ConcentricDraw'
import { CycleArrow } from '../Landing/graphics/CycleArrow'
import { GaugeSweep } from '../Landing/graphics/GaugeSweep'
import { LinkedRings } from '../Landing/graphics/LinkedRings'
import { OrbitingSpheres } from '../Landing/graphics/OrbitingSpheres'
import { VennCluster } from '../Landing/graphics/VennCluster'
import { BrandSection } from './BrandSection'
import { brandSections } from './brand'

const illustrations: { name: string; Graphic: React.ComponentType }[] = [
  { name: 'Concentric', Graphic: ConcentricDraw },
  { name: 'Linked Rings', Graphic: LinkedRings },
  { name: 'Orbit', Graphic: OrbitingSpheres },
  { name: 'Cluster', Graphic: VennCluster },
  { name: 'Gauge', Graphic: GaugeSweep },
  { name: 'Cycle', Graphic: CycleArrow },
]

// Recolor the shared landing graphics for the dark brand surface. The canvas
// components read these inherited CSS custom properties at draw time.
const graphicTheme = {
  '--color-graphic-stroke': '#adadad',
  '--color-graphic-dim': '#2e2e2e',
} as React.CSSProperties

export function IllustrationSection() {
  return (
    <BrandSection
      meta={brandSections[3]}
      title="A geometric system in motion"
      lead="A family of line illustrations built from clear primitives and thin strokes. Quiet, exact, and legible at any size."
    >
      <div
        style={graphicTheme}
        className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3"
      >
        {illustrations.map(({ name, Graphic }) => (
          <div key={name} className="bg-brand-raised flex flex-col gap-6 p-8">
            <div className="aspect-square w-full">
              <Graphic />
            </div>
          </div>
        ))}
      </div>
    </BrandSection>
  )
}
