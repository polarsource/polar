'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import { Adapters } from './Adapters'
import { Benefits } from './Benefits'
import { Checkout } from './Checkout'
import { FeaturedTestimonial } from './FeaturedTestimonial'
import Features from './Features'
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
      <Section className="flex flex-col gap-y-24 pt-0 md:pt-0">
        <Hero className="relative z-10" />
        <Features />
        <Adapters />
        <SDKs />
        <Usage />
        <FeaturedTestimonial
          href="https://x.com/rauchg/status/1909810055622672851"
          name="Guillermo Rauch"
          title="CEO & Founder of Vercel"
          avatarUrl="/assets/landing/testamonials/rauch.jpg"
          quote="The speed at which Polar is executing on the financial infrastructure primitives the new world needs is very impressive"
        />
      </Section>
      <Testimonials />
      <Section className="flex flex-col gap-y-24">
        <Checkout />
        <MerchantOfRecord />
        <Benefits />
        <Upsell />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Tools />
        <Pricing />
      </Section>
    </>
  )
}
