import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Testimonials } from '@/components/Landing/Testimonials'
import { Benefits } from './Benefits'
import { Checkout } from './Checkout'
import { Intro } from './Intro'
import { Pricing } from './Pricing'
import SDKs from './SDKs'
import { Section } from './Section'
import { Tools } from './Tools'

export default function Page() {
  return (
    <div className="flex w-full flex-col items-center pt-32 md:pt-0">
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-36">
        <Hero />
        {/* <Features /> */}
        <Intro />
        <Benefits />

        <div className="flex flex-col gap-y-12">
          <h1 className="text-4xl leading-snug tracking-tight md:text-5xl md:leading-tight">
            Polar as Merchant of Record.{' '}
            <span className="dark:text-polar-500 text-gray-400">
              Leave all tax & VAT headaches to us. Focus on your passion, while
              we build infrastructure to get you paid.
            </span>
          </h1>
        </div>

        <MerchantOfRecord />
        <SDKs />
        <Testimonials />
        <Checkout />
        <Tools />
        <Pricing />
      </Section>
    </>
  )
}
