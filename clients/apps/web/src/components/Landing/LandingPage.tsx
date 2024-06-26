import { Community } from '@/components/Landing/Community'
import { Hero } from '@/components/Landing/Hero/Hero'
import { LastPitch } from '@/components/Landing/LastPitch'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Monetization } from '@/components/Landing/Monetization'
import { Testamonials } from '@/components/Landing/Testamonials'
import { Separator } from 'polarkit/components/ui/separator'
import { API } from './API'
import { Pricing } from './Pricing'
import { Section } from './Section'

export default function Page() {
  return (
    <div className="flex flex-col items-center">
      <Hero />
      <Separator className="w-screen" />
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-32">
        <Monetization />
      </Section>

      <Separator className="w-screen" />

      <Section>
        <MerchantOfRecord />
      </Section>

      <Separator className="w-screen" />

      <Section>
        <Community />
      </Section>

      <Separator className="w-screen" />

      <API />

      <Separator className="w-screen" />

      <Testamonials />

      <Separator className="w-screen" />

      <Pricing />

      <Separator className="w-screen" />

      <LastPitch />
    </>
  )
}
