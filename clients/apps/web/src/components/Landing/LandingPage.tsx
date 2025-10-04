'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import Image from 'next/image'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Adapters } from './Adapters'
import { Benefits } from './Benefits'
import { Checkout } from './Checkout'
import Features from './Features'
import { Pricing } from './Pricing'
import SDKs from './SDKs'
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
  return (
    <>
      <Section className="flex flex-col gap-y-32 pt-0 md:pt-0">
        <Hero
          title="Monetize your software"
          description="Turn your software into a business with 6 lines of code"
        >
          <GetStartedButton size="lg" text="Get Started" />
          <Link
            href="/resources/why"
            prefetch
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
        <Adapters />
        <SDKs />
        <Usage />
        <Link
          href="https://x.com/rauchg/status/1909810055622672851"
          className="flex flex-col items-center gap-y-12 text-center transition-opacity hover:opacity-80"
          target="_blank"
        >
          <div className="flex flex-col items-center gap-y-2">
            <h2 className="text-6xl">”</h2>
            <h2 className="leading-relaxed! text-2xl md:text-4xl">
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
        <Benefits />
        <Testimonials />
      </Section>
      <Section className="flex flex-col gap-y-24">
        <Pricing />
      </Section>
    </>
  )
}
