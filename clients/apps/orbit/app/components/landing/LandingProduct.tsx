'use client'

import { SectionHeading } from './SectionHeading'
import { Button } from './Button'
import { LandingSection } from './LandingSection'

/**
 * LandingProduct — two-column layout. Left: heading + description.
 * Right: PhyllotaxisSunflower graphic.
 */
export const LandingProduct = () => (
  <LandingSection id="product">
    <div className="flex flex-col items-center gap-y-16 p-16 py-48 text-center">
      <SectionHeading>
        Your entire billing stack.
        <br />
        In one integration.
      </SectionHeading>
      <p className="max-w-4xl text-4xl leading-snug">
        Metering, billing, invoicing, analytics, and customer management. All
        behind a single API.
      </p>

      <div className="flex flex-row items-center gap-x-6">
        <Button href="#">Get Started</Button>
        <Button href="#" variant="secondary">
          Documentation
        </Button>
      </div>
    </div>
  </LandingSection>
)
