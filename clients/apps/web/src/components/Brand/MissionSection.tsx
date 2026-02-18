import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { VORTEX_GLSL } from './shaders/geometry/vortex'
import { WAVES_GLSL } from './shaders/geometry/waves'
import { asciiEffect } from './shaders/pass/ascii'
import { ditherEffect } from './shaders/pass/dither'

const asciiVortex = asciiEffect({
  cellSize: 12,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#0e0e0e',
  darkColorB: '#ffffff',
})

const ditherWave = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#0e0e0e',
  darkColorB: '#ffffff',
})

export function MissionSection() {
  return (
    <SectionLayout label="01 / Mission" className="relative h-full w-full">
      <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-16 bg-gray-100">
        <ShaderCanvas
          geometry={VORTEX_GLSL}
          effect={asciiVortex}
          className="h-full w-full"
        >
          <div className="flex flex-col items-center gap-12">
            <PolarLogotype logoVariant="icon" size={80} />
            <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tight text-pretty dark:font-light">
              Your AI moves fast.
              <br />
              So should your billing.
            </h2>
            <span className="font-[Louize] text-4xl italic">polar.sh</span>
          </div>
        </ShaderCanvas>
        <ShaderCanvas
          geometry={WAVES_GLSL}
          effect={ditherWave}
          className="h-full w-full"
        >
          <div className="flex flex-col items-center gap-12">
            <PolarLogotype logoVariant="icon" size={80} />
            <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tight text-pretty dark:font-light">
              Your AI moves fast.
              <br />
              So should your billing.
            </h2>
            <span className="font-[Louize] text-4xl italic">polar.sh</span>
          </div>
        </ShaderCanvas>
      </div>
    </SectionLayout>
  )
}
