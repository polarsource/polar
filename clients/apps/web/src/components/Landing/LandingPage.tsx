'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import { Benefits } from './Benefits'
import { Checkout } from './Checkout'
import Features from './Features'
import { Intro } from './Intro'
import { Pricing } from './Pricing'
import SDKs from './SDKs'
import { Section } from './Section'
import { Tools } from './Tools'
import { Upsell } from './Upsell'
import { Usage } from './Usage'

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Hero className="relative z-10" />
      <Section className="flex flex-col gap-y-24">
        <Features />
        <Intro />
        <SDKs />
        <Usage />
      </Section>
      <Testimonials />
      <Section className="flex flex-col gap-y-24">
        <Benefits />
        <MerchantOfRecord />
        <Checkout />
        <Upsell />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Tools />
        <Pricing />
      </Section>
    </>
  )
}
