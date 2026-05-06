'use client'
import { Box } from '@polar-sh/orbit/Box'

import { Hero } from '@/components/Landing/Hero/Hero'
import { Testimonials } from '@/components/Landing/Testimonials'
import GetStartedButton from '../Auth/GetStartedButton'
import { Pricing } from './Pricing'
import { Section } from './Section'
import { Upsell } from './Upsell'
import { Usage } from './Usage'
import { Vision } from './Vision'
import { Features } from './Features'
import { Logotypes } from './Logotypes'
import { UseCases } from './UseCases'

export default function Page() {
  return (
    <Box display="flex" flexDirection="column">
      <PageContent />
    </Box>
  )
}

const PageContent = () => {
  return (
    <>
      <Section paddingTop={false}>
        <Hero
          title="Turn Usage Into Revenue"
          description="A billing platform built for AI companies"
          size="large"
        >
          <GetStartedButton size="lg" text="Get Started" />
        </Hero>
        <Usage />
      </Section>
      <Features />
      <Section>
        <Vision />
      </Section>
      <UseCases />
      <Section>
        <Logotypes />
        <Testimonials />
      </Section>
      <Section>
        <Upsell />
        <Pricing />
      </Section>
    </>
  )
}
