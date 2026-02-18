import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'
import { VortexASCII } from './VortexASCII'

export function MissionSection() {
  return (
    <SectionLayout
      label="01 / Mission"
      className="relative h-full w-full items-center justify-center"
    >
      <div className="dark:bg-polar-900 flex h-full w-full flex-col items-center justify-center gap-8 bg-gray-100">
        <VortexASCII
          className="h-full w-full"
          colorA="#f3f4f6"
          colorB="#000000"
          darkColorA="#0e0e0e"
          darkColorB="#ffffff"
          cellSize={12}
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
        </VortexASCII>
      </div>
    </SectionLayout>
  )
}
