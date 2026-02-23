import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { CIRCLES_GLSL } from './shaders/geometry/circles'
import { RIPPLES_GLSL } from './shaders/geometry/ripples'
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

export function CardSection() {
  return (
    <SectionLayout label="Cards" className="h-fit">
      <div className="flex h-full w-full flex-col">
        <div className="grid grid-cols-2 gap-24">
          <ShaderCanvas
            geometry={RIPPLES_GLSL}
            effect={ditherRipples}
            className="aspect-square"
          >
            <div className="flex flex-col items-center gap-12">
              <PolarLogotype logoVariant="icon" size={64} />
              <h3 className="text-center text-5xl leading-tight tracking-tighter text-pretty dark:font-light">
                Usage billing keeping you up?
                <br />
                We run it on autopilot.
              </h3>
              <span className="font-louize text-3xl">polar.sh</span>
            </div>
          </ShaderCanvas>
          <ShaderCanvas
            geometry={CIRCLES_GLSL}
            effect={ditherCircles}
            className="aspect-square"
          >
            <div className="flex flex-col items-center gap-12">
              <PolarLogotype logoVariant="icon" size={64} />
              <h3 className="text-center text-5xl leading-tight tracking-tighter text-pretty dark:font-light">
                From prompt to revenue.
                <br />
                Automatically.
              </h3>
              <span className="font-louize text-3xl">polar.sh</span>
            </div>
          </ShaderCanvas>
          <ShaderCanvas
            geometry={VORTEX_GLSL}
            effect={ditherCaustics}
            className="aspect-square"
          >
            <div className="flex flex-col items-center gap-12">
              <PolarLogotype logoVariant="icon" size={64} />
              <h3 className="text-center text-5xl leading-tight tracking-tighter text-pretty dark:font-light">
                We count tokens.
                <br />
                So you don't have to.
              </h3>
              <span className="font-louize text-3xl">polar.sh</span>
            </div>
          </ShaderCanvas>
        </div>
      </div>
    </SectionLayout>
  )
}
