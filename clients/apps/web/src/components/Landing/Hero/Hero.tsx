'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Section } from '@/components/Landing/Section'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'

export const Hero = () => {
  return (
    <Section
      className="flex w-full flex-col items-center gap-24 md:py-24"
      wrapperClassName="relative isolate overflow-hidden"
    >
      <div className="relative z-20 flex w-full flex-col items-center gap-y-12 text-center xl:w-2/3">
        <div className="z-20 flex flex-col items-center gap-y-12">
          <h1 className="text-balance text-4xl leading-snug text-gray-950 md:text-7xl md:leading-tight dark:text-white">
            The best monetization platform for developers
          </h1>
          <div className="flex flex-col items-center gap-y-4 xl:w-2/3">
            <p className="dark:text-polar-500 text-2xl leading-relaxed text-gray-500">
              An open source Lemon Squeezy alternative. Leave VAT, taxes &
              billing to us.
            </p>
            <p className="dark:text-polar-600 text-xs leading-normal text-gray-400">
              By using Polar you agree to our{' '}
              <Link
                className="dark:text-polar-500 text-blue-500"
                href="/legal/terms"
                target="_blank"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                className="dark:text-polar-500 text-blue-500"
                href="/legal/privacy"
                target="_blank"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="z-20 flex flex-row items-center gap-x-4">
          {/* <div className="dark:bg-polar-800 flex flex-row items-center gap-x-2 rounded-full bg-white py-2 pl-6 pr-2">
            <div className="flex flex-row items-center gap-x-0.5">
              <span>polar.sh/</span>
              <input
                autoFocus
                className="border-none border-transparent bg-transparent p-0 focus:border-transparent focus:ring-0"
                placeholder="my-organization"
              />
            </div>
            <GetStartedButton
              wrapperClassNames="p-0"
              className="px-4 py-2 text-sm"
            />
          </div> */}
          <GetStartedButton />
          <a target="_blank" href="https://github.com/polarsource/polar">
            <Button size="lg" variant="ghost">
              Star on GitHub
            </Button>
          </a>
        </div>
      </div>
      <video
        src="/assets/landing/polar_ui_2.webm"
        width="100%"
        className="dark:border-polar-700 xl:rounded-4xl aspect-video rounded-2xl border border-gray-200 lg:rounded-3xl"
        autoPlay
        playsInline
        muted
      />
    </Section>
  )
}
