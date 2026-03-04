'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Adapters } from './Adapters'
import { BillingDiagram } from './BillingDiagram'
import Features from './Features'
import { Logotypes } from './Logotypes'
import { Pricing } from './Pricing'
import { Section } from './Section'
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
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <Hero
          title="Turn Usage Into Revenue"
          description="A billing platform built for AI companies"
        >
          <GetStartedButton size="lg" text="Get Started" />
          <Link
            href="/resources/why"
            prefetch
            className="dark:text-polar-400 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <Button
              variant="secondary"
              size="lg"
              className="dark:bg-polar-800 rounded-full border-none bg-white"
            >
              Why Polar
            </Button>
          </Link>
        </Hero>
      </Section>
      <Section className="flex flex-col gap-y-32" border>
        <Logotypes />
        <Features />
      </Section>
      <Section className="flex flex-col gap-y-32">
        <Usage />
        <BillingDiagram />
        <Adapters />
      </Section>
      <Section className="flex flex-col gap-y-24" border>
        <BillingDiagram />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <MerchantOfRecord />
        <Testimonials />
      </Section>
      <Section className="flex flex-col gap-y-24" border>
        <Pricing />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Upsell />
      </Section>
    </>
  )
}
