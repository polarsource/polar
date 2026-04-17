'use client'

import { CircularBand } from '../CircularBand'
import { SectionLabel } from './SectionLabel'
import { SectionHeading } from './SectionHeading'

/**
 * LandingHero — two-column hero. Left: standalone CircularBand graphic
 * filling the full column. Right: headline + one-liner. No overlay text
 * on the graphic.
 */
export const LandingHero = () => (
  <section className="grid grid-cols-2 divide-x divide-neutral-800 border-b border-neutral-800">
    {/* Left — graphic, standalone */}
    <div className="relative overflow-hidden">
      <CircularBand fill />
    </div>

    {/* Right — text */}
    <div className="flex flex-col justify-between p-16">
      <div className="flex flex-col gap-4">
        <SectionLabel number="001" label="Billing for AI products" />
      </div>

      <div>
        <SectionHeading className="leading-[0.95]">
          From Inference
          <br />
          to Invoice
        </SectionHeading>
      </div>

      <a
        href="#get-started"
        className="w-fit border border-white px-8 py-4 text-base font-medium text-white transition hover:bg-white hover:text-black"
      >
        Get Started
      </a>
    </div>
  </section>
)
