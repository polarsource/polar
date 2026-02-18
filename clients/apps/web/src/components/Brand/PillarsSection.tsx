'use client'

import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { CIRCLES_GLSL } from './shaders/geometry/circles'
import { DIAMOND_GLSL } from './shaders/geometry/diamond'
import { HELIX_GLSL } from './shaders/geometry/helix'
import { pixelEffect } from './shaders/pass/pixel'

const PIXEL = 24

const pillarA = pixelEffect({
  pixelSize: PIXEL,
  gap: 0,
  colorA: '#f2f2f2',
  colorB: '#000000',
  darkColorA: '#0a0a0a',
  darkColorB: '#ffffff',
})

const pillarB = pixelEffect({
  pixelSize: PIXEL,
  gap: 0,
  colorA: '#f2f2f2',
  colorB: '#333333',
  darkColorA: '#0a0a0a',
  darkColorB: '#d9d9d9',
})

const pillarC = pixelEffect({
  pixelSize: PIXEL,
  gap: 0,
  colorA: '#f2f2f2',
  colorB: '#000000',
  darkColorA: '#0a0a0a',
  darkColorB: '#ffffff',
})

const pillars = [
  {
    id: 'tokenize',
    label: 'TOKENIZE',
    geometry: CIRCLES_GLSL,
    effect: pillarA,
  },
  { id: 'reduce', label: 'REDUCE', geometry: DIAMOND_GLSL, effect: pillarB },
  { id: 'monetize', label: 'MONETIZE', geometry: HELIX_GLSL, effect: pillarC },
]

export function PillarsSection() {
  return (
    <SectionLayout label="Pillars">
      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
        {pillars.map((p) => (
          <div key={p.id} className="relative">
            <ShaderCanvas
              geometry={p.geometry}
              effect={p.effect}
              className="aspect-square"
            />
            <div
              className="dark:bg-[#0a0a0a] absolute z-10 flex items-end bg-[#f2f2f2]"
              style={{
                bottom: PIXEL * 2,
                left: PIXEL * 2,
                right: PIXEL * 2,
                height: PIXEL * 3,
                padding: PIXEL,
              }}
            >
              <span
                className="font-mono tracking-widest text-black dark:text-white"
                style={{ lineHeight: `${PIXEL}px` }}
              >
                {p.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </SectionLayout>
  )
}
