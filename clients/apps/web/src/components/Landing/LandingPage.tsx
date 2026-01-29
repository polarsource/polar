'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import useIsMobile from '@/utils/mobile'
import { Stream } from '@cloudflare/stream-react'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Adapters } from './Adapters'
import { Checkout } from './Checkout'
import Features from './Features'
import { Logotypes } from './Logotypes'
import { Pricing } from './Pricing'
import { Section } from './Section'
import { Usage } from './Usage'

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  const { isMobile } = useIsMobile()

  return (
    <>
      <Section className="flex flex-col gap-y-32 py-0 md:py-0">
        <Hero
          title="Monetize your software"
          description="Turn your software into a business with 6 lines of code"
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
        <Features />
        <Logotypes />
        {isMobile ? null : (
          <div className="dark:border-polar-800 relative aspect-video w-full overflow-hidden border border-gray-200">
            <Stream
              src="8fb79c2cb066f3d9e982ad5ad3eb9fc4"
              letterboxColor="black"
              autoplay
              muted
              loop
            />
          </div>
        )}
        <Adapters />
        <Usage />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Checkout />
        <MerchantOfRecord />
        <Testimonials />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Pricing />
      </Section>
    </>
  )
}
