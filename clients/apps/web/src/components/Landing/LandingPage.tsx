'use client'

import { Margins } from './chapters/Margins'
import { MerchantOfRecord } from './chapters/MerchantOfRecord'
import { Meter } from './chapters/Meter'
import { ClosingCta } from './ClosingCta'
import { Hero } from './Hero/Hero'
import { LogoStrip } from './LogoStrip'
import { Pricing } from './Pricing'
import { Testimonials } from './Testimonials'
import { Vision } from './Vision'

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <Hero />
      <LogoStrip />
      <Meter />
      <MerchantOfRecord />
      <Margins />
      <Vision />
      <Testimonials />
      <Pricing />
      <ClosingCta />
    </div>
  )
}
