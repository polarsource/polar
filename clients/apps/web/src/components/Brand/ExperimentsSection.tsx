'use client'

import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { MESH_GLSL } from './shaders/geometry/mesh'
import { rawEffect } from './shaders/pass/raw'
import { pixelEffect } from './shaders/pass/pixel'

const meshPixel = pixelEffect({
  pixelSize: 126,
  gap: 0,
  colorMode: true,
  colorA: '#f2f2f2',
  darkColorA: '#0a0a0a',
})

const orbEffect = rawEffect()

export function ExperimentsSection() {
  return (
    <SectionLayout label="Experiments">
      <div className="flex w-full flex-col gap-y-12">
        {/* Pixelated mesh */}
        <ShaderCanvas
          geometry={MESH_GLSL}
          effect={meshPixel}
          className="aspect-[2/1] w-full"
        />

        {/* Orb */}
        <div className="flex items-center justify-center bg-white py-24">
          <div className="h-48 w-48 overflow-hidden rounded-full shadow-2xl">
            <ShaderCanvas
              geometry={MESH_GLSL}
              effect={orbEffect}
              className="h-full w-full"
            />
          </div>
        </div>
      </div>
    </SectionLayout>
  )
}
