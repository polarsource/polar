'use client'

import { Stream } from '@cloudflare/stream-react'
import { SectionLabel } from './SectionLabel'
import { SectionHeading } from './SectionHeading'

/**
 * LandingDemo — two-column layout. Left: section label + heading.
 * Right: product demo video via Cloudflare Stream.
 */
export const LandingDemo = () => (
  <section className="border-b border-neutral-200 dark:border-neutral-800">
    <div className="grid grid-cols-2 divide-x divide-neutral-200 dark:divide-neutral-800">
      {/* Left — text */}
      <div className="flex flex-col justify-between p-16 py-32">
        <SectionLabel number="002.C" label="Product" />
        <SectionHeading className="mt-16">
          See it
          <br />
          in action
        </SectionHeading>
        <p className="max-w-md text-lg leading-snug text-neutral-400">
          The full billing pipeline — from event ingestion to paid invoice.
        </p>
      </div>

      {/* Right — video */}
      <div className="relative flex items-center justify-center">
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
