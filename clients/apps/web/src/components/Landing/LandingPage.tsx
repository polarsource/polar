'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'
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

        <Link
          href="https://x.com/rauchg/status/1909810055622672851"
          className="flex flex-col items-center gap-y-12 text-center transition-opacity hover:opacity-80"
          target="_blank"
        >
          <div className="flex flex-col items-center gap-y-2">
            <h2 className="text-6xl">”</h2>
            <h2 className="text-2xl !leading-relaxed md:text-4xl">
              The speed at which Polar is executing on the financial
              infrastructure primitives the new world needs is very impressive
            </h2>
          </div>
          <div className="flex flex-col items-center gap-y-4">
            <Avatar
              name="Guillermo Rauch"
              className="h-16 w-16"
              avatar_url="/assets/landing/testamonials/rauch.jpg"
            />
            <div className="flex flex-col">
              <span className="">Guillermo Rauch</span>
              <span className="dark:text-polar-500 text-gray-500">
                CEO & Founder of Vercel
              </span>
            </div>
          </div>
        </Link>

        <Intro />
        <SDKs />
        <Usage />
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
