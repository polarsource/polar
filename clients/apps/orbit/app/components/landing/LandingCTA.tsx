'use client'

import { SectionLabel } from './SectionLabel'
import { SectionHeading } from './SectionHeading'
import { TextRings } from '../TextRings'

/**
 * LandingCTA — two-column: left has TerrainSphere graphic,
 * right has heading + copy + buttons.
 */
export const LandingCTA = () => (
  <section className="border-b border-neutral-800">
    <div className="grid grid-cols-2 divide-x divide-neutral-800">
      {/* Left — graphic */}
      <div className="relative overflow-hidden">
        <TextRings />
      </div>

      {/* Right — text + buttons */}
      <div className="flex flex-col justify-between p-16 py-24">
        <SectionHeading className="mt-16">
          Start billing
          <br />
          in minutes
        </SectionHeading>
        <div>
          <p className="max-w-sm text-2xl leading-snug">
            Integrate once. Polar handles metering, pricing, invoicing, and
            revenue analytics — so your team ships product, not billing
            infrastructure.
          </p>
          <div className="flex gap-4 pt-8">
            <a
              href="#"
              className="border border-white px-6 py-3 text-base font-medium text-white uppercase transition hover:bg-white hover:text-black"
            >
              Create Account
            </a>
            <a
              href="#"
              className="border border-neutral-700 px-6 py-3 text-base font-medium text-neutral-400 uppercase transition hover:border-neutral-500 hover:text-white"
            >
              Read Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
)
