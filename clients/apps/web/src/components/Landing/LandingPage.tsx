import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Monetization } from '@/components/Landing/Monetization'
import { Testamonials } from '@/components/Landing/Testamonials'
import { API } from './API'
import { Benefits } from './Benefits'
import { Pricing } from './Pricing'
import { Section } from './Section'

export default function Page() {
  return (
    <div className="flex w-full flex-col items-center divide-y">
      <Hero />
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-32">
        <Benefits />
        <Monetization />
        <MerchantOfRecord />
      </Section>

      <Testamonials />

      <API />

      <Pricing />
    </>
  )
}
