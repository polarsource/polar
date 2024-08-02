import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { FeatureSection } from '@/components/Landing/FeatureSection'
import { PageContent } from '@/components/Landing/LandingPage'
import { Section } from '@/components/Landing/Section'
import { Circles } from '@/components/Landing/molecules/Circles'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'

const PAGE_TITLE = 'Donations'
const PAGE_DESCRIPTION = 'Your very own tip jar — without any strings attached'

export default function Page() {
  return (
    <>
      <Section className="relative flex flex-col gap-16 md:flex-row md:justify-between md:gap-32 md:py-24">
        <Circles className="absolute inset-0 top-1/2 -z-10 block -translate-y-1/2 text-black dark:hidden" />
        <Circles className="absolute inset-0 top-1/2 -z-10 hidden -translate-y-1/2 text-white dark:block" />
        <div className="relative flex flex-col gap-y-8 md:w-1/2">
          <h1 className="text-4xl md:text-5xl md:leading-snug">{PAGE_TITLE}</h1>
          <p className="text-lg md:text-xl md:leading-normal">
            {PAGE_DESCRIPTION}
          </p>
          <div className="flex flex-col gap-y-8">
            <GithubLoginButton
              className="self-start"
              size="large"
              text="Continue with GitHub"
              userSignupType={UserSignupType.MAINTAINER}
              returnTo="/dashboard"
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
        <picture className="relative md:w-1/2">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={`/assets/landing/donations/donations_dark.png`}
          />
          <img
            className="rounded-2xl"
            alt="Issue Funding Badge"
            src={`/assets/landing/donations/donations.png`}
          />
        </picture>
      </Section>

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="An easy way to accept donations"
        description="Polar provides a dashboard to keep track of incoming donations"
        media={{
          dark: '/assets/landing/donations/dashboard_dark.png',
          light: '/assets/landing/donations/dashboard.png',
        }}
        features={[
          'Accept donations without any strings attached',
          'Keep track of incoming donations with the Donation Dashboard',
          'Withdraw your donations at any time',
        ]}
      />

      <PageContent />
    </>
  )
}

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    description: PAGE_DESCRIPTION,
  },
}
