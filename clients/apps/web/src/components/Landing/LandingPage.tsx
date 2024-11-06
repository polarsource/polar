import { Hero } from '@/components/Landing/Hero/Hero'
import { MerchantOfRecord } from '@/components/Landing/MOR'
import { Monetization } from '@/components/Landing/Monetization'
import { Testimonials } from '@/components/Landing/Testimonials'
import {
  ArrowsRightLeftIcon,
  CommandLineIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/outline'
import { API } from './API'
import { Benefits } from './Benefits'
import { GetStarted } from './GetStarted'
import { Pricing } from './Pricing'
import { Section } from './Section'

export default function Page() {
  return (
    <div className="flex w-full flex-col items-center">
      <PageContent />
    </div>
  )
}

export const PageContent = () => {
  return (
    <>
      <Section className="flex flex-col gap-y-36">
        <Hero />

        <div className="dark:bg-polar-950 rounded-4xl flex w-full flex-col gap-y-12 bg-gray-50 p-8 md:p-16 dark:bg-[radial-gradient(400px_at_top,rgba(20,20,25,1)_0%,rgba(7,7,9,1)_100%)]">
          <div className="flex flex-col items-center gap-y-6">
            <span className="shadow-3xl dark:border-polar-800 dark:bg-polar-700 flex w-fit flex-row items-baseline gap-x-2 rounded-xl bg-white px-4 py-2 font-mono dark:border">
              <span>$</span>
              <span>npx polar-init</span>
            </span>
            <h1 className="w-fit max-w-xl text-pretty text-center text-2xl md:text-4xl md:leading-normal">
              The fastest way to setup SaaS & digital products
            </h1>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
              <div className="flex flex-row items-center gap-x-3">
                <CommandLineIcon className="h-5 w-5" />
                <h1 className="text-xl">npx polar-init</h1>
              </div>
              <p className="dark:text-polar-400 text-gray-600">
                Bootstrap products, subscriptions & checkouts in your Next.js or
                Nuxt.js project.
              </p>
            </div>
            <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
              <div className="flex flex-row items-center gap-x-3">
                <CubeTransparentIcon className="h-5 w-5" />
                <h1 className="text-xl">Sandbox</h1>
              </div>
              <p className="dark:text-polar-400 text-gray-600">
                Defaults to our sandbox environment, so you can test your
                integration without risk
              </p>
            </div>
            <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
              <div className="flex flex-row items-center gap-x-3">
                <ArrowsRightLeftIcon className="h-5 w-5" />
                <h1 className="text-xl">Webhooks</h1>
              </div>
              <p className="dark:text-polar-400 text-gray-600">
                Receive webhooks for all events, including payments,
                subscriptions, and more.
              </p>
            </div>
          </div>
        </div>

        <Benefits />

        <div className="flex flex-col gap-y-12">
          <h1 className="text-2xl tracking-tight md:text-5xl md:leading-tight">
            Polar as Merchant of Record.{' '}
            <span className="dark:text-polar-500 text-gray-400">
              Leave all tax & VAT headaches to us. Focus on your passion, while
              we build infrastructure to get you paid.
            </span>
          </h1>
        </div>

        <MerchantOfRecord />
        <Monetization />
        <GetStarted />
      </Section>

      <Pricing />
      <API />

      <Testimonials />
    </>
  )
}
