'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { Testimonials } from '@/components/Landing/Testimonials'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Pricing } from './Pricing'
import { Section } from './Section'
import { Upsell } from './Upsell'
import { Usage } from './Usage'
import { Vision } from './Vision'
import { Features } from './Features'
import { Logotypes } from './Logotypes'

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageContent />
    </div>
  )
}

const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col pt-0 md:pt-0">
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
        <Usage />
      </Section>
      <Features />
      <Section>
        <Vision />
      </Section>
      <Section>
        <Testimonials />
        <Logotypes />
      </Section>
      <Section>
        <Upsell />
        <Pricing />
      </Section>
    </>
  )
}
