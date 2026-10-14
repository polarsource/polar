'use client'

import { Margins } from './chapters/Margins'
import { MerchantOfRecord } from './chapters/MerchantOfRecord'
import { Meter } from './chapters/Meter'
import { Platform } from './chapters/Platform'
import { Primitives } from './chapters/Primitives'
import { StartupProgram } from './chapters/StartupProgram'
import { UsageBilling } from './chapters/UsageBilling'
import { ClosingCta } from './ClosingCta'
import { CustomerStory } from './CustomerStory'
import { Hero } from './Hero/Hero'
import { MissionRulers } from './Hero/MissionRulers'
import { Pricing } from './Pricing'
import { Testimonials } from './Testimonials'

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <Hero />
      <UsageBilling />
      <CustomerStory />
      <Primitives />
      <MissionRulers />
      <Platform />
      <Meter />
      <MerchantOfRecord />
      <Margins />
      <Testimonials />
      <Pricing />
      <StartupProgram />
      <ClosingCta />
    </div>
  )
}
