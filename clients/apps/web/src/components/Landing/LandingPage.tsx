'use client'

import { Hero } from '@/components/Landing/Hero/Hero'
import { Testimonials } from '@/components/Landing/Testimonials'
import { CostInsights } from './CostInsights'
import { Dashboard } from './Dashboard'
import { Features } from './Features'
import { Logotypes } from './Logotypes'
import { Pipeline } from './Pipeline'
import { Pricing } from './Pricing'
import { Section } from './Section'
import { StartupProgramCallout } from './StartupProgramCallout'
import { Upsell } from './Upsell'
import { Usage } from './Usage'
import { UseCases } from './UseCases'
import { Vision } from './Vision'

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
      {/* Intro */}
      <Section className="flex flex-col pt-0 md:pt-0">
        <Hero />
        <Logotypes />
        <Usage />
      </Section>

      {/* Pricing models */}
      <Section>
        <Features />
      </Section>

      {/* Financial overview */}
      <Section>
        <Dashboard />
        <CostInsights />
        <UseCases />
        <Pipeline />
      </Section>

      {/* Vision */}
      <Section>
        <Vision />
      </Section>

      {/* Social proof */}
      <Section>
        <Testimonials />
      </Section>

      {/* Conversion */}
      <Section>
        <Upsell />
        <Pricing />
        <StartupProgramCallout />
      </Section>
    </>
  )
}
