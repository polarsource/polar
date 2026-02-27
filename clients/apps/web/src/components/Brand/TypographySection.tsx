import { Headline } from '@polar-sh/orbit'
import { SectionLayout } from './SectionLayout'

export function TypographySection() {
  return (
    <SectionLayout label="Typography">
      <div className="grid h-full grid-cols-1 gap-8 md:grid-cols-4 md:gap-32">
        {/* Left column — description */}
        <div className="flex flex-col justify-between">
          <div className="flex flex-col gap-6">
            <Headline as="h2" text="Typeface System" />
            {/* eslint-disable-next-line no-restricted-syntax */}
            <p className="dark:text-polar-500 text-lg leading-relaxed text-neutral-500">
              <a
                href="https://rsms.me/inter/"
                target="_blank"
                rel="noopener noreferrer"
                className="dark:text-polar-50 text-neutral-900 underline"
              >
                Inter
              </a>{' '}
              is the primary typeface of the Polar identity. It was selected for
              its clarity, neutrality, and structured geometry, aligning with
              the brand&apos;s emphasis on precision and controlled
              communication.
            </p>
          </div>
        </div>

        {/* Right column — specimen area */}
        <div className="dark:bg-polar-900 col-span-1 flex flex-col justify-between overflow-hidden bg-neutral-50 p-6 md:col-span-3 md:p-12">
          <div className="flex flex-col gap-y-8">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <span className="text-[clamp(80px,10vw,140px)] leading-[0.9] font-light tracking-tighter">
              Inter
            </span>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <span className="dark:text-polar-700 text-[clamp(80px,10vw,140px)] leading-[0.9] font-light tracking-tighter text-neutral-300">
              AaBb
            </span>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <span className="dark:text-polar-700 text-[clamp(80px,10vw,140px)] leading-[0.9] font-light tracking-tighter text-neutral-300">
              0123
            </span>
          </div>
        </div>
      </div>
    </SectionLayout>
  )
}
