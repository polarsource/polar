'use client'

import { SectionHeading } from './SectionHeading'
import { ShapeGrid } from '../ShapeGrid'

/**
 * LandingProduct — two-column layout. Left: heading + description.
 * Right: PhyllotaxisSunflower graphic.
 */
export const LandingProduct = () => (
  <section id="product">
    <div className="flex flex-col items-center gap-y-16 p-16 py-48 text-center">
      <SectionHeading>
        Not just usage billing.
        <br />
        Polar is your commerce layer.
      </SectionHeading>
      <p className="max-w-4xl text-4xl leading-snug">
        A single API that replaces your metering pipeline, billing engine, cost
        insights, revenue dashboard & customer management.
      </p>

      <div className="flex flex-row items-center gap-x-6">
        <a
          href="#"
          className="w-fit rounded-full bg-white px-8 py-4 text-base font-bold text-black transition [font-variation-settings:'opsz'_32] hover:bg-dark-100"
        >
          Get Started
        </a>
        <a
          href="#"
          className="w-fit rounded-full bg-dark-850 px-8 py-4 text-base font-semibold text-white transition [font-variation-settings:'opsz'_32] hover:bg-dark-800"
        >
          Documentation
        </a>
      </div>
    </div>
  </section>
)
