import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import { Benefits } from './Benefits'
import { Checkout } from './Checkout'
import { Features } from './Features'
import { Intro } from './Intro'
import { Video } from './molecules/Video'
import { Pricing } from './Pricing'
import SDKs from './SDKs'
import { Section } from './Section'
import { Tools } from './Tools'

export default function Page() {
  return (
    <div className="flex w-full flex-col items-center pt-24 md:pt-0">
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-24">
        <Hero />
        <Intro />
        <SDKs />
        <Benefits />
        <MerchantOfRecord />
        <Checkout />
        <Features />
        <Video src="/assets/landing/Polar2024.webm" />
        <Testimonials />
        <Tools />
        <Pricing />
      </Section>
    </>
  )
}
