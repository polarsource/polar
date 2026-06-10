'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { Testimonials } from '@/components/Landing/Testimonials'
import { Button } from '@polar-sh/orbit'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'
import { Pricing } from './Pricing'
import { Section } from './Section'
import { StartupProgramCallout } from './StartupProgramCallout'
import { Upsell } from './Upsell'
import { Usage } from './Usage'
import { Vision } from './Vision'
import { Features } from './Features'
import { Logotypes } from './Logotypes'
import { UseCases } from './UseCases'
import { Dashboard } from './Dashboard'
import { CostInsights } from './CostInsights'
import { Pipeline } from './Pipeline'

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
        <Hero />
        <Logotypes />
        <Usage />
        <Dashboard />
      </Section>
      <Features />

      <Section>
        <CostInsights />
        <Pipeline />
        <Vision />
      </Section>

      <UseCases />
      <Section>
        <Testimonials />
      </Section>
      <Section>
        <Upsell />
        <Pricing />
        <StartupProgramCallout />
      </Section>
    </>
  )
}
