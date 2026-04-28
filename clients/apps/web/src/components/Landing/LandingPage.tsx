'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { Testimonials } from '@/components/Landing/Testimonials'
import useIsMobile from '@/utils/mobile'
import { Stream } from '@cloudflare/stream-react'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Logotypes } from './Logotypes'
import { Pricing } from './Pricing'
import { Section } from './Section'
import { Upsell } from './Upsell'
import { Usage } from './Usage'
import { Vision } from './Vision'
import { Features } from './Features'

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
      <Features />
      <Section>
        <Vision />
        <Usage />
      </Section>
      <Section>
        <Testimonials />
      </Section>
      <Section>
        <Pricing />
        <Upsell />
      </Section>
    </>
  )
}
