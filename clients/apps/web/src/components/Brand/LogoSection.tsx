import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'

export function LogoSection() {
  return (
    <SectionLayout
      label="02 / Logo"
      footer={
        <div className="flex items-center gap-8 text-xs text-neutral-400">
          <span>Minimum size: 24px</span>
          <span>Clear space: 1x height</span>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-12">
        <div className="flex items-center gap-16">
          <div className="flex h-40 w-40 items-center justify-center rounded-3xl border border-neutral-200">
            <PolarLogotype logoVariant="icon" size={100} />
          </div>
          <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-black">
            <PolarLogotype
              logoVariant="icon"
              logoClassName="text-white"
              size={100}
            />
          </div>
        </div>
        <p className="max-w-md text-center text-sm leading-relaxed text-neutral-400">
          Use the Polar logotype with generous clear space.
        </p>
      </div>
    </SectionLayout>
  )
}
