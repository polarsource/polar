import { DitherShader } from './DitherShader'
import { SectionLayout } from './SectionLayout'

export function DitherSection() {
  return (
    <SectionLayout
      label="03 / Dither"
      className="relative h-full w-full items-center justify-center"
    >
      <DitherShader
        className="h-full w-full"
        colorA="#000000"
        colorB="#ffffff"
        darkColorA="#ffffff"
        darkColorB="#000000"
        pixelSize={3}
      />
    </SectionLayout>
  )
}
