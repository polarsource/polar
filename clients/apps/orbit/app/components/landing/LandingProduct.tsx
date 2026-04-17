'use client'

import { Stream } from '@cloudflare/stream-react'
import { SectionLabel } from './SectionLabel'

/**
 * LandingProduct — two-column layout. Left: heading + description.
 * Right: product demo video.
 */
export const LandingProduct = () => (
  <section id="product" className="border-b border-neutral-800">
    <div className="grid grid-cols-2 divide-x divide-neutral-800">
      {/* Left column — heading */}
      <div className="flex flex-col justify-between p-16 py-32">
        <SectionLabel number="002" label="Product" />
        <div className="py-20">
          <h2 className="text-[clamp(2rem,5vw,4.5rem)] leading-[1.05] font-normal text-white [font-variation-settings:'opsz'_32]">
            Not just metering.
            <br />
            The complete
            <br />
            commerce layer.
          </h2>
        </div>
        <p className="max-w-lg text-2xl leading-snug">
          A single API that replaces your metering pipeline, billing engine,
          invoice generator, and revenue dashboard.
        </p>
      </div>

      {/* Right column — video */}
      <div className="relative flex items-center">
        <div className="relative aspect-video w-full overflow-hidden">
          <Stream
            src="8fb79c2cb066f3d9e982ad5ad3eb9fc4"
            autoplay
            muted
            loop
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </div>
  </section>
)
