'use client'

import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { MESH_GLSL } from './shaders/geometry/mesh'
import { pixelEffect } from './shaders/pass/pixel'

const meshPixel = pixelEffect({
  pixelSize: 126,
  gap: 0,
  colorMode: true,
  colorA: '#f2f2f2',
  darkColorA: '#0a0a0a',
})

export function ExperimentsSection() {
  return (
    <SectionLayout label="Experiments">
      <div className="w-full">
        <ShaderCanvas
          geometry={MESH_GLSL}
          effect={meshPixel}
          className="aspect-[2/1] w-full"
        />
      </div>
    </SectionLayout>
  )
}
