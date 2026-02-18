import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { VORTEX_GLSL } from './shaders/geometry/vortex'
import { asciiEffect } from './shaders/pass/ascii'
import { ditherEffect } from './shaders/pass/dither'

const asciiVortex = asciiEffect({
  cellSize: 12,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#000000',
  darkColorB: '#ffffff',
})

const ditherRipples = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#000000',
  darkColorB: '#ffffff',
})

const ditherCircles = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#000000',
  darkColorB: '#ffffff',
})

const ditherCaustics = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#000000',
  darkColorB: '#ffffff',
})

export function MissionSection() {
  return (
    <SectionLayout label="01 / Mission" className="h-fit">
      <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-16 bg-gray-100">
        <ShaderCanvas
          geometry={VORTEX_GLSL}
          effect={asciiVortex}
          className="py-64"
        >
          <div className="flex flex-col items-center gap-16 py-12">
            <PolarLogotype logoVariant="icon" size={80} />
            <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tighter text-pretty dark:font-light">
              Your AI moves fast.
              <br />
              So should your billing.
            </h2>
            <span className="font-[Louize] text-5xl italic">polar.sh</span>
          </div>
        </ShaderCanvas>
      </div>
    </SectionLayout>
  )
}
