import { SectionLayout } from './SectionLayout'
import { Vortex } from './Vortex'

export function MissionSection() {
  return (
    <SectionLayout
      label="01 / Mission"
      className="relative h-full w-full items-center justify-center"
    >
      <div className="dark:bg-polar-900 flex h-full w-full flex-col items-center justify-center gap-8 bg-gray-100">
        <Vortex
          className="h-full w-full"
          colorA="#cccccc"
          colorB="#000000"
          darkColorA="#000000"
          darkColorB="#ffffff"
        >
          <div className="flex flex-col items-center gap-6">
            <h2 className="w-full max-w-5xl text-center text-7xl leading-tight font-light tracking-tight text-pretty">
              From prompt to billing in a single platform
            </h2>
          </div>
        </Vortex>
      </div>
    </SectionLayout>
  )
}
