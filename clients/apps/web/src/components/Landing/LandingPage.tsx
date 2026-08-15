'use client'

import { Margins } from './chapters/Margins'
import { MerchantOfRecord } from './chapters/MerchantOfRecord'
import { Meter } from './chapters/Meter'
import { Platform } from './chapters/Platform'
import { ClosingCta } from './ClosingCta'
import { Hero } from './Hero/Hero'
import { Pricing } from './Pricing'
import { Testimonials } from './Testimonials'

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <Hero />
      <Platform />
      <Meter />
      <MerchantOfRecord />
      <Margins />
      <Testimonials />
      <Pricing />
      <ClosingCta />
    </div>
  )
}
