import { DitherShader } from './DitherShader'
import { SectionLayout } from './SectionLayout'

export function MissionSection() {
  return (
    <div className="relative h-full w-full">
      <div className="relative z-10 h-full">
        <SectionLayout
          label="01 / Mission"
          className="relative h-full w-full items-center justify-center"
        >
          <div className="dark:bg-polar-900 absolute inset-x-0 inset-y-24 flex flex-col items-center justify-center gap-8 bg-gray-100">
            <h2 className="w-full max-w-2xl text-center text-7xl leading-tight tracking-tight text-balance">
              Modern Billing for the AI era
            </h2>
          </div>
        </SectionLayout>
        <DitherShader
          className="h-96 w-96"
          colorA="#000000"
          colorB="#ffffff"
          darkColorA="#ffffff"
          darkColorB="#000000"
          pixelSize={3}
        />
      </div>
    </div>
  )
}
