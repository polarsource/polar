'use client'

import { MerchantOfRecord } from './chapters/MerchantOfRecord'
import { Meter } from './chapters/Meter'
import { StartupProgram } from './chapters/StartupProgram'
import { UsageBilling } from './chapters/UsageBilling'
import { ClosingCta } from './ClosingCta'
import { CustomerStory } from './CustomerStory'
import { Hero } from './Hero/Hero'
import { Pricing } from './Pricing'
import { Agents, Charge, Understand } from './story/chapters'
import { Testimonials } from './Testimonials'

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <Hero />
      <UsageBilling />
      <CustomerStory />
      <Meter />
      <Charge />
      <Understand />
      <MerchantOfRecord />
      <Agents />
      <Testimonials />
      <Pricing />
      <StartupProgram />
      <ClosingCta />
    </div>
  )
}
