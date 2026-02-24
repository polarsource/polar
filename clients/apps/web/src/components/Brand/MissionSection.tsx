import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { Headline } from '@polar-sh/orbit'
import { SectionLayout } from './SectionLayout'
import { ShaderCanvas } from './ShaderCanvas'
import { CIRCLES_GLSL } from './shaders/geometry/circles'
import { VORTEX_GLSL } from './shaders/geometry/vortex'
import { ditherEffect } from './shaders/pass/dither'

const ditherCircles = ditherEffect({
  pixelSize: 6,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#000000',
  darkColorB: '#ffffff',
})

const ditherCaustics = ditherEffect({
  pixelSize: 6,
  colorA: '#f3f4f6',
  colorB: '#000000',
  darkColorA: '#000000',
  darkColorB: '#ffffff',
})

export function MissionSection() {
  return (
    <SectionLayout className="h-fit">
      <div className="flex h-full w-full flex-col">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-24">
          <ShaderCanvas
            geometry={CIRCLES_GLSL}
            effect={ditherCircles}
            className="aspect-square"
          >
            <div className="flex flex-col items-center gap-8 md:gap-12">
              <PolarLogotype logoVariant="icon" size={64} />
              <Headline
                as="h3"
                className="text-center text-pretty"
                text={['From prompt to revenue.', 'Automatically.']}
              />
              <span className="font-louize text-xl md:text-4xl">polar.sh</span>
            </div>
          </ShaderCanvas>
          <ShaderCanvas
            geometry={VORTEX_GLSL}
            effect={ditherCaustics}
            className="aspect-square"
          >
            <div className="flex flex-col items-center gap-8 md:gap-12">
              <PolarLogotype logoVariant="icon" size={64} />
              <Headline
                as="h3"
                className="text-center text-pretty"
                text={['We count tokens.', "So you don't have to."]}
              />
              <span className="font-louize text-xl md:text-4xl">polar.sh</span>
            </div>
          </ShaderCanvas>
        </div>
      </div>
    </SectionLayout>
  )
}
