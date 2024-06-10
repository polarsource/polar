import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { Section } from '@/components/Landing/Section'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'

export const Hero = () => {
  return (
    <Section className="flex w-full flex-col gap-y-12 py-40 text-center">
      <div className="flex flex-col items-center gap-y-8">
        <h1 className="w-3/4 text-balance text-7xl leading-normal text-gray-950 dark:text-white">
          Funding & Monetization tools for Developers
        </h1>
        <p className="dark:text-polar-200 w-2/3 text-balance text-xl leading-loose text-gray-500">
          The all-in-one funding & monetization platform for open source & indie
          developers. Built entirely open source.
        </p>
      </div>

      <div className="flex flex-col items-center gap-y-8">
        <GithubLoginButton
          className="w-fit"
          size="large"
          text="Sign up with GitHub"
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
