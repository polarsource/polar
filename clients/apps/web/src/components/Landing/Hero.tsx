import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { Section } from '@/components/Landing/Section'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { Circles } from './molecules/Circles'

export const Hero = () => {
  return (
    <Section
      className="flex w-full flex-col gap-y-12 py-32"
      wrapperClassName="relative isolate overflow-hidden"
    >
      <Circles className="absolute inset-0 top-1/2 block -translate-y-1/2 text-black dark:hidden" />
      <Circles className="absolute inset-0 top-1/2 hidden -translate-y-1/2 text-white dark:block" />
      <div className="z-20 flex flex-col gap-y-16">
        <h1 className="text-balance text-5xl leading-snug text-gray-950 md:w-3/4 md:text-7xl md:leading-tight dark:text-white">
          Get paid coding on your passion
        </h1>
        <div className="flex flex-col">
          <p className="text-balance text-xl leading-loose">
            Polar is the best funding & monetization platform for developers.
          </p>
          <p className="text-balance text-xl leading-loose">
            Focus on your passion and leave VAT, sales tax and billing to us.
          </p>
        </div>
      </div>
      <div className="z-20 flex flex-col gap-y-8">
        <GithubLoginButton
          className="self-start"
          size="large"
          text="Continue with GitHub"
          userSignupType={UserSignupType.MAINTAINER}
          returnTo="/maintainer"
        />
        <p className="dark:text-polar-500 text-xs leading-normal text-gray-400">
          By using Polar you agree to our{' '}
          <Link
            className="dark:text-polar-300 text-blue-500"
            href="/legal/terms"
            target="_blank"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            className="dark:text-polar-300 text-blue-500"
            href="/legal/privacy"
            target="_blank"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </Section>
  )
}
