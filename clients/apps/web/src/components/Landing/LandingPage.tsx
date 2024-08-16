import { Community } from '@/components/Landing/Community'
import { Hero } from '@/components/Landing/Hero/Hero'
import { LastPitch } from '@/components/Landing/LastPitch'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Monetization } from '@/components/Landing/Monetization'
import { Testamonials } from '@/components/Landing/Testamonials'
import { API } from './API'
import { Pricing } from './Pricing'
import { Section } from './Section'

export default function Page() {
  return (
    <div className="flex w-full flex-col items-center">
      <Hero />
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section
        wrapperClassName="dark:bg-black"
        className="flex flex-col gap-y-32"
      >
        <Monetization />
      </Section>

      <Section>
        <MerchantOfRecord />
      </Section>

      <Testamonials />

      <Section>
        <Community />
      </Section>

      <API />

      <Pricing />

      <LastPitch />
    </>
  )
}
