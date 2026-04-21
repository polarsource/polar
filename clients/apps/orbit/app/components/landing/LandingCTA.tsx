'use client'

import { SectionHeading } from './SectionHeading'
import { Button } from './Button'
import { TextRings } from '../TextRings'

/**
 * LandingCTA — two-column: left has TerrainSphere graphic,
 * right has heading + copy + buttons.
 */
export const LandingCTA = () => (
  <section className="">
    <div className="grid grid-cols-2">
      {/* Left — graphic */}
      <div className="relative overflow-hidden bg-dark-900">
        <TextRings />
      </div>

      {/* Right — text + buttons */}
      <div className="flex flex-col gap-y-16 p-16 py-24">
        <SectionHeading>
          Start billing
          <br />
          in minutes
        </SectionHeading>
        <div className="flex flex-col gap-y-12">
          <p className="max-w-xl text-2xl leading-snug">
            Integrate once. Polar handles metering, pricing, invoicing, and
            revenue analytics — so your team ships product, not billing
            infrastructure.
          </p>
          <div className="flex gap-4 pt-8">
            <Button href="#">Create Account</Button>
            <Button href="#" variant="secondary">
              Read Documentation
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
)
