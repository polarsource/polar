'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import { Benefits } from './Benefits'
import { Checkout } from './Checkout'
import Features from './Features'
import { Intro } from './Intro'
import { Video } from './molecules/Video'
import { Pricing } from './Pricing'
import SDKs from './SDKs'
import { Section } from './Section'
import { Tools } from './Tools'
import { Upsell } from './Upsell'

export default function Page() {
  return (
    <div className="flex w-full flex-col items-center">
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-24">
        <Hero className="relative z-10" />
        <Features />
        <Intro />
        <SDKs />
      </Section>
      <Testimonials />
      <Section className="flex flex-col gap-y-24">
        <Benefits />
        <MerchantOfRecord />
        <Checkout />
        <Upsell />
      </Section>
      <div className="flex w-full flex-col items-center justify-center px-4 py-16 md:max-w-[1440px] md:px-8">
        <Video src="/assets/landing/Polar2024.webm" />
      </div>
      <Section className="flex flex-col gap-y-24">
        <Tools />
        <Pricing />
      </Section>
    </>
  )
}
