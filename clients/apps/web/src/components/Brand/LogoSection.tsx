import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'

export function LogoSection() {
  return (
    <SectionLayout label="02 / Logo" className="flex-1">
      <div className="grid h-full w-full flex-1 grid-cols-2 grid-rows-2 gap-8">
        <div className="flex items-center justify-center bg-neutral-100">
          <PolarLogotype
            logoVariant="icon"
            logoClassName="!text-black"
            size={140}
          />
        </div>
        <div className="flex items-center justify-center bg-black">
          <PolarLogotype
            logoVariant="icon"
            logoClassName="text-white"
            size={140}
          />
        </div>
        <div className="flex items-center justify-center bg-neutral-100">
          <PolarLogotype
            logoVariant="logotype"
            logoClassName="!text-black"
            size={300}
          />
        </div>
        <div className="flex items-center justify-center bg-black">
          <PolarLogotype
            logoVariant="logotype"
            logoClassName="text-white"
            size={300}
          />
        </div>
      </div>
    </SectionLayout>
  )
}
