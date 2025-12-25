'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import useIsMobile from '@/utils/mobile'
import { Stream } from '@cloudflare/stream-react'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import Image from 'next/image'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Adapters } from './Adapters'
import { Checkout } from './Checkout'
import { Events } from './Events'
import Features from './Features'
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
          description="Turn your software into a business with 4 lines of code"
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
        {isMobile ? null : (
          <div className="dark:border-polar-700 relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 md:rounded-3xl">
            <Stream
              src="8fb79c2cb066f3d9e982ad5ad3eb9fc4"
              letterboxColor="black"
              autoplay
              muted
              loop
            />
          </div>
        )}
        <Events />
        <Adapters />
        <Usage />
        <Link
          href="https://x.com/rauchg/status/1909810055622672851"
          className="flex flex-col items-center gap-y-12 text-center transition-opacity hover:opacity-80"
          target="_blank"
        >
          <div className="flex flex-col items-center gap-y-2">
            <h2 className="text-6xl">”</h2>
            <h2 className="text-2xl leading-relaxed! md:text-4xl">
              The speed at which Polar is executing on the financial
              infrastructure primitives the new world needs is very impressive
            </h2>
          </div>
          <div className="flex flex-col items-center gap-y-4">
            <Avatar
              name="Guillermo Rauch"
              avatar_url="/assets/landing/testamonials/rauch.jpg"
              className="h-16 w-16"
              width={64}
              height={64}
              loading="lazy"
              CustomImageComponent={Image}
            />
            <div className="flex flex-col">
              <span className="">Guillermo Rauch</span>
              <span className="dark:text-polar-500 text-gray-500">
                CEO & Founder of Vercel
              </span>
            </div>
          </div>
        </Link>
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
