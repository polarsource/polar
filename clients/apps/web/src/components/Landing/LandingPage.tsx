import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Monetization } from '@/components/Landing/Monetization'
import { Testamonials } from '@/components/Landing/Testamonials'
import { Separator } from 'polarkit/components/ui/separator'
import { API } from './API'
import { Benefits } from './Benefits'
import { Pricing } from './Pricing'
import { Section } from './Section'

export default function Page() {
  return (
    <div className="flex w-full flex-col items-center divide-y">
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-24 md:py-24">
        <Hero />
        <Benefits />
        <Separator />
        <Monetization />
        <MerchantOfRecord />
      </Section>

      <Pricing />
      <API />

      <Testamonials />
    </>
  )
}
