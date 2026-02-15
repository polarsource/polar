import { SectionLayout } from './SectionLayout'

export function TypographySection() {
  return (
    <SectionLayout label="04 / Typography">
      <div className="grid h-full grid-cols-[320px_1fr] gap-16">
        {/* Left column — description */}
        <div className="flex flex-col justify-between">
          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              Typeface System
            </h2>
            <p className="text-sm leading-relaxed text-neutral-500">
              <a
                href="https://rsms.me/inter/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-900 underline"
              >
                Inter
              </a>{' '}
              is the primary typeface of the Polar identity. It was selected for
              its clarity, neutrality, and structured geometry, aligning with
              the brand&apos;s emphasis on precision and controlled
              communication.
            </p>
          </div>

          {/* Character set */}
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-medium tracking-widest text-neutral-400 uppercase">
              Character Set
            </span>
            <p className="font-mono text-[11px] leading-relaxed tracking-wide text-neutral-400">
              ABCDEFGHIJKLM
              <br />
              NOPQRSTUVWXYZ
              <br />
              abcdefghijklm
              <br />
              nopqrstuvwxyz
              <br />
              0123456789
              <br />
              !@#$%^&*()+-=
            </p>
          </div>
        </div>

        {/* Right column — specimen area */}
        <div className="dark:bg-polar-900 flex flex-col justify-between overflow-hidden bg-neutral-50 p-12">
          <div className="flex flex-col gap-1">
            <span className="text-[clamp(80px,10vw,140px)] leading-[0.9] font-light tracking-tighter">
              Inter
            </span>
            <span className="text-[clamp(80px,10vw,140px)] leading-[0.9] font-light tracking-tighter text-neutral-300">
              Inter
            </span>
          </div>
        </div>
      </div>
    </SectionLayout>
  )
}
