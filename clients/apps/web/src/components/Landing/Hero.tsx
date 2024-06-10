import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { Section } from '@/components/Landing/Section'
import { UserSignupType } from '@polar-sh/sdk'
import Image from 'next/image'
import Link from 'next/link'

export const Hero = () => {
  return (
    <Section className="flex w-full flex-col md:flex-row">
      <div className="flex flex-col gap-y-12 py-16 md:w-1/2">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-pretty text-6xl leading-tight text-gray-950 dark:text-white">
            Funding & Monetization tools for Developers
          </h1>
          <p className="dark:text-polar-500 text-xl leading-relaxed text-gray-500">
            The all-in-one funding & monetization platform for open source- and
            indie developers. Built entirely open source.
          </p>
        </div>

        <div className="flex flex-col items-start gap-y-8">
          <GithubLoginButton
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
      </div>
      <div className="flex flex-col items-center justify-center p-12 md:w-1/2">
        <Image
          className="block dark:hidden"
          src="/assets/landing/subscriptions_view.webp"
          alt="Polar Subscriptions Page"
          width={800}
          height={640}
        />
        <Image
          className="hidden dark:block"
          src="/assets/landing/subscriptions_view_dark.png"
          alt="Polar Subscriptions Page"
          width={800}
          height={640}
        />
      </div>
    </Section>
  )
}
