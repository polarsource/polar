import { Community } from '@/components/Landing/Community'
import { Hero } from '@/components/Landing/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Monetization } from '@/components/Landing/Monetization'
import { Testamonials } from '@/components/Landing/Testamonials'
import { Separator } from 'polarkit/components/ui/separator'
import { API } from './API'
import { Benefits } from './Benefits'
import { Pricing } from './Pricing'
import { Section } from './Section'
import { Circles } from './molecules/Circles'

export default function Page() {
  return (
    <div className="flex flex-col items-center">
      <Hero />
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-24">
        <Monetization />
        <MerchantOfRecord />
        <Community />
      </Section>

      <Separator className="w-screen" />

      <Section
        id="benefits"
        className="gap-y-24"
        wrapperClassName="overflow-hidden"
      >
        <Circles className="absolute inset-0 top-1/2 -z-10 hidden -translate-y-1/2 text-white dark:block" />
        <Circles className="absolute inset-0 top-1/2 -z-10 block -translate-y-1/2 text-black dark:hidden" />
        <Benefits />
      </Section>

      <Separator className="w-screen" />

      <Testamonials />

      <Separator className="w-screen" />

      <Pricing />

      <Separator className="w-screen" />

      <API />
    </>
  )
}
