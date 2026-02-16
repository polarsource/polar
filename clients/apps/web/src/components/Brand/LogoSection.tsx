import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'

export function LogoSection() {
  return (
    <SectionLayout
      label="02 / Logo"
      className="flex-1"
      footer={
        <div className="flex items-center gap-8 text-xs text-neutral-400">
          <span>Minimum size: 24px</span>
          <span>Clear space: 1x height</span>
        </div>
      }
    >
      <div className="grid h-full w-full flex-1 grid-cols-2 grid-rows-2 gap-8">
        <div className="flex items-center justify-center bg-white">
          <PolarLogotype logoVariant="icon" logoClassName="!text-black" size={100} />
        </div>
        <div className="flex items-center justify-center bg-black">
          <PolarLogotype
            logoVariant="icon"
            logoClassName="text-white"
            size={100}
          />
        </div>
        <div className="flex items-center justify-center bg-white">
          <PolarLogotype logoVariant="logotype" logoClassName="!text-black" size={120} />
        </div>
        <div className="flex items-center justify-center bg-black">
          <PolarLogotype
            logoVariant="logotype"
            logoClassName="text-white"
            size={120}
          />
        </div>
      </div>
    </SectionLayout>
  )
}
