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
import Features from './Features'
import { Logotypes } from './Logotypes'
import Offering from './Offering'
import { Pricing } from './Pricing'
import { Purpose } from './Purpose'
import { Section } from './Section'

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
          className="xl:pt-16"
          title="Monetize your software"
          titleClassName="xl:text-9xl!"
          description="Polar runs your business on Autopilot."
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
      </Section>

      <Section className="flex flex-col md:py-32 xl:max-w-[1620px]">
        {isMobile ? null : (
          <div className="relative aspect-video w-full">
            <Stream
              src="8fb79c2cb066f3d9e982ad5ad3eb9fc4"
              letterboxColor="black"
              autoplay
              muted
              loop
            />
          </div>
        )}
      </Section>
      <Section className="dark:border-polar-700 flex flex-col gap-y-24 border-b border-gray-300 pb-24!">
        <Adapters />
      </Section>
      <Offering className="py-16 md:py-24" />
      <Purpose className="py-16 md:py-24" />
      <Section className="flex flex-col gap-y-24">
        <MerchantOfRecord />
        <Testimonials />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Pricing />
      </Section>
    </>
  )
}
