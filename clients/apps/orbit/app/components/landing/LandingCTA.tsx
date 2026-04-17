import { SectionLabel } from './SectionLabel'

/**
 * LandingCTA — final call-to-action block with large typography
 * and a stark, minimal button treatment.
 */
export const LandingCTA = () => (
  <section className="border-b border-neutral-800">
    <div className="grid grid-cols-2 divide-x divide-neutral-800">
      <div className="flex flex-col justify-between p-16 py-48">
        <SectionLabel number="005" label="Get Started" />
        <h2 className="mt-16 text-[clamp(2rem,5vw,4.5rem)] font-normal [font-variation-settings:'opsz'_32] leading-[1.05] text-white">
          Start billing
          <br />
          in minutes
        </h2>
      </div>

      <div className="flex flex-col justify-end gap-6 p-16 py-48">
        <p className="max-w-sm text-2xl leading-snug">
          Integrate once. Polar handles metering, pricing, invoicing,
          and revenue analytics — so your team ships product, not
          billing infrastructure.
        </p>
        <div className="flex gap-4 pt-4">
          <a
            href="#"
            className="border border-white px-6 py-3 text-base font-medium uppercase text-white transition hover:bg-white hover:text-black"
          >
            Create Account
          </a>
          <a
            href="#"
            className="border border-neutral-700 px-6 py-3 text-base font-medium uppercase text-neutral-400 transition hover:border-neutral-500 hover:text-white"
          >
            Read Documentation
          </a>
        </div>
      </div>
    </div>
  </section>
)
