'use client'

import { SectionHeading } from './SectionHeading'
import { Button } from './Button'
import { ShapeGrid } from '../ShapeGrid'
import { Stream } from '@cloudflare/stream-react'

/**
 * LandingProduct — two-column layout. Left: heading + description.
 * Right: PhyllotaxisSunflower graphic.
 */
export const LandingProduct = () => (
  <section id="product">
    <div className="flex flex-col items-center gap-y-16 p-16 py-48 text-center">
      <SectionHeading>
        One integration.
        <br />
        Infinite revenue models.
      </SectionHeading>
      <p className="max-w-4xl text-4xl leading-snug">
        Metering, billing, invoicing, analytics, and customer management — all
        behind a single API.
      </p>

      <div className="flex flex-row items-center gap-x-6">
        <Button href="#">Get Started</Button>
        <Button href="#" variant="secondary">
          Documentation
        </Button>
      </div>
    </div>
  </section>
)
