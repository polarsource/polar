'use client'

import { SectionHeading } from './SectionHeading'
import { ShapeGrid } from '../ShapeGrid'

/**
 * LandingProduct — two-column layout. Left: heading + description.
 * Right: PhyllotaxisSunflower graphic.
 */
export const LandingProduct = () => (
  <section id="product" className="border-b border-neutral-800">
    <div className="grid grid-cols-2 divide-x divide-neutral-800">
      {/* Left column — heading */}
      <div className="flex flex-col justify-between p-16 py-32">
        <SectionHeading>
          Not just metering.
          <br />
          The complete
          <br />
          commerce layer.
        </SectionHeading>
        <p className="max-w-lg text-2xl leading-snug">
          A single API that replaces your metering pipeline, billing engine,
          invoice generator, and revenue dashboard.
        </p>
      </div>

      {/* Right column — graphic */}
      <div className="relative overflow-hidden">
        <ShapeGrid />
      </div>
    </div>
  </section>
)
