'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { Testimonials } from '@/components/Landing/Testimonials'
import useIsMobile from '@/utils/mobile'
import { Stream } from '@cloudflare/stream-react'
import { Button } from '@polar-sh/orbit'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Adapters } from './Adapters'
import { BillingDiagram } from './BillingDiagram'
import Features from './Features'
import { Logotypes } from './Logotypes'
import { Pricing } from './Pricing'
import { Products } from './Products'
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

const PageContent = () => {
  const { isMobile } = useIsMobile()
  return (
    <>
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <Hero
          title="Turn Usage Into Revenue"
          description="A billing platform built for AI companies"
          size="large"
        >
          <GetStartedButton size="lg" text="Get Started" />
          <Link
            href="/resources/why"
            prefetch
            className="dark:text-polar-400 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <Button variant="secondary" size="lg">
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
        <BillingDiagram />
        <Usage />
      </Section>
      {isMobile ? null : (
        <Section className="flex max-w-[1620px]! flex-col gap-y-32">
          <div className="dark:border-polar-700 relative aspect-video w-full flex-col items-center overflow-hidden rounded-xl border border-gray-200 md:rounded-3xl">
            <Stream
              src="8fb79c2cb066f3d9e982ad5ad3eb9fc4"
              autoplay
              muted
              loop
            />
          </div>
        </Section>
      )}
      <Section className="flex flex-col gap-y-32" border>
        <Adapters />
      </Section>
      <Section className="flex flex-col gap-y-32" border>
        <Products />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Testimonials />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Pricing />
        <Upsell />
      </Section>
    </>
  )
}
