import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { CIRCLES_GLSL } from './shaders/geometry/circles'
import { CAUSTICS_GLSL } from './shaders/geometry/caustics'
import { RIPPLES_GLSL } from './shaders/geometry/ripples'
import { SMOKE_GLSL } from './shaders/geometry/smoke'
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

const ditherSmoke = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#0e0e0e',
  darkColorB: '#ffffff',
})

const ditherRipples = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#0e0e0e',
  darkColorB: '#ffffff',
})

const ditherCircles = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#0e0e0e',
  darkColorB: '#ffffff',
})

const ditherCaustics = ditherEffect({
  pixelSize: 3,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#0e0e0e',
  darkColorB: '#ffffff',
})

export function MissionSection() {
  return (
    <>
      <SectionLayout label="01 / Mission">
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

      <SectionLayout label="02 / Waves">
        <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-16 bg-gray-100">
          <ShaderCanvas
            geometry={WAVES_GLSL}
            effect={ditherWave}
            className="py-64"
          >
            <div className="flex flex-col items-center gap-16 py-12">
              <PolarLogotype logoVariant="icon" size={80} />
              <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tighter text-pretty dark:font-light">
                Usage billing keeping you up?
                <br />
                Polar runs it on autopilot.
              </h2>
              <span className="font-[Louize] text-5xl italic">polar.sh</span>
            </div>
          </ShaderCanvas>
        </div>
      </SectionLayout>

      <SectionLayout label="03 / Smoke">
        <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-16 bg-gray-100">
          <ShaderCanvas
            geometry={SMOKE_GLSL}
            effect={ditherSmoke}
            className="py-64"
          >
            <div className="flex flex-col items-center gap-16 py-12">
              <PolarLogotype logoVariant="icon" size={80} />
              <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tighter text-pretty dark:font-light">
                Ship faster.
                <br />
                We handle the rest.
              </h2>
              <span className="font-[Louize] text-5xl italic">polar.sh</span>
            </div>
          </ShaderCanvas>
        </div>
      </SectionLayout>

      <SectionLayout label="04 / Ripples">
        <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-16 bg-gray-100">
          <ShaderCanvas
            geometry={RIPPLES_GLSL}
            effect={ditherRipples}
            className="py-64"
          >
            <div className="flex flex-col items-center gap-16 py-12">
              <PolarLogotype logoVariant="icon" size={80} />
              <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tighter text-pretty dark:font-light">
                One API.
                <br />
                Infinite possibilities.
              </h2>
              <span className="font-[Louize] text-5xl italic">polar.sh</span>
            </div>
          </ShaderCanvas>
        </div>
      </SectionLayout>

      <SectionLayout label="05 / Circles">
        <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-16 bg-gray-100">
          <ShaderCanvas
            geometry={CIRCLES_GLSL}
            effect={ditherCircles}
            className="py-64"
          >
            <div className="flex flex-col items-center gap-16 py-12">
              <PolarLogotype logoVariant="icon" size={80} />
              <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tighter text-pretty dark:font-light">
                Built for developers.
                <br />
                Loved by finance.
              </h2>
              <span className="font-[Louize] text-5xl italic">polar.sh</span>
            </div>
          </ShaderCanvas>
        </div>
      </SectionLayout>

      <SectionLayout label="06 / Caustics">
        <div className="dark:bg-polar-900 flex h-full w-full flex-col gap-y-16 bg-gray-100">
          <ShaderCanvas
            geometry={CAUSTICS_GLSL}
            effect={ditherCaustics}
            className="py-64"
          >
            <div className="flex flex-col items-center gap-16 py-12">
              <PolarLogotype logoVariant="icon" size={80} />
              <h2 className="w-full max-w-5xl text-center text-7xl leading-tight tracking-tighter text-pretty dark:font-light">
                Payments that flow.
                <br />
                Infrastructure that holds.
              </h2>
              <span className="font-[Louize] text-5xl italic">polar.sh</span>
            </div>
          </ShaderCanvas>
        </div>
      </SectionLayout>
    </>
  )
}
