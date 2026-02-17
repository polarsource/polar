import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'

export function LogoSection() {
  return (
    <SectionLayout label="02 / Logo" className="flex-1">
      <div className="grid h-full w-full flex-1 grid-cols-2 grid-rows-2 gap-8">
        <div className="bg-polar-900 flex aspect-square h-full items-center justify-center">
          <PolarLogotype
            logoVariant="logotype"
            logoClassName="text-white"
            size={300}
          />
        </div>
        <div className="bg-polar-900 flex aspect-square h-full items-center justify-center">
          <PolarLogotype
            logoVariant="icon"
            logoClassName="text-white"
            size={140}
          />
        </div>
      </div>
    </SectionLayout>
  )
}
