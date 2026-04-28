'use client'

import { CircularBand } from '../CircularBand'
import { SectionLabel } from './SectionLabel'
import { SectionHeading } from './SectionHeading'
import { LandingSection } from './LandingSection'

/**
 * LandingHero — two-column hero. Left: standalone CircularBand graphic
 * filling the full column. Right: headline + one-liner. No overlay text
 * on the graphic.
 */
export const LandingHero = () => (
  <LandingSection className="flex h-screen flex-col justify-center">
    <SectionHeading>
      Billing built for
      <br />
      intelligent software.
    </SectionHeading>
  </LandingSection>
)
