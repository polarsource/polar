import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'

export function LogoSection() {
  return (
    <SectionLayout label="02 / Logo">
      <div className="grid h-full w-full flex-1 grid-cols-2 grid-rows-2 gap-8">
        <div className="dark:bg-polar-900 flex aspect-square h-full items-center justify-center bg-neutral-100">
          <PolarLogotype
            logoVariant="logotype"
            logoClassName="dark:text-white"
            size={300}
          />
        </div>
        <div className="dark:bg-polar-900 flex aspect-square h-full items-center justify-center bg-neutral-100">
          <PolarLogotype
            logoVariant="icon"
            logoClassName="dark:text-white"
            size={140}
          />
        </div>
      </div>
    </SectionLayout>
  )
}
