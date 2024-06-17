import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { FeatureSection } from '@/components/Landing/FeatureSection'
import { PageContent } from '@/components/Landing/LandingPage'
import { Section } from '@/components/Landing/Section'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { Separator } from 'polarkit/components/ui/separator'

const PAGE_TITLE = 'Issue Funding & Rewards'
const PAGE_DESCRIPTION = 'A new way to crowdfund your backlog of GitHub issues'

const steps = [
  {
    title: 'Mark as Completed',
    description:
      'As soon as the issue is fixed, mark it as completed to prepare transfer of funds.',
  },
  {
    title: 'Confirm Rewards',
    description:
      'Confirm rewards for the contributors who helped you fix the issue.',
  },
  {
    title: 'Get Paid',
    description:
      'The funded amount is paid out & the contributors gets their reward.',
  },
]

export default function Page() {
  return (
    <>
      <Section className="flex flex-col gap-16 md:flex-row md:justify-between md:gap-32 md:py-24">
        <div className="flex flex-col gap-y-8 md:w-1/2">
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
        <picture className="md:w-1/2">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={`/assets/landing/fund_dark.svg`}
          />
          <img
            className="border-gray-75 dark:border-polar-700 rounded-2xl border"
            alt="Issue Funding Badge"
            src={`/assets/landing/fund.svg`}
          />
        </picture>
      </Section>

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="Seamlessly badge issues"
        description="Promote funding on your GitHub issues without any manual overhead"
        media={{
          dark: '/assets/landing/issue-funding/funding_modal_dark.png',
          light: '/assets/landing/issue-funding/funding_modal.png',
        }}
        features={[
          'Customize the Embed',
          'Set optional funding goal',
          'Target issues using the Polar label',
          'Deploy the embed on issues automatically',
        ]}
      />

      <FeatureSection
        title="Contributor Rewards"
        description="Reward contributors who help you fix your GitHub issues"
        media={{
          dark: '/assets/landing/issue-funding/rewards_dark.png',
          light: '/assets/landing/issue-funding/rewards.png',
        }}
        features={[
          'Setup rewards for contributors',
          'Adjust individual rewards before transferring funds',
          'Boost rewards by funding the issue yourself',
        ]}
        direction="row-reverse"
      />

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="Crowdfunded Backlog"
        description="Automatically synced with your GitHub issues"
        media={{
          dark: '/assets/landing/issue-funding/completed_dark.png',
          light: '/assets/landing/issue-funding/completed.png',
        }}
        features={[
          'A dashboard overview of your funded issues',
          'Promote your funded issues on the Public Page',
        ]}
      />

      <Section className="flex flex-col items-center gap-16 md:gap-24 md:py-24">
        <h1 className="px-4 text-center text-4xl leading-snug">
          Rewarding contributors has never been easier
        </h1>
        <picture>
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={`/assets/landing/issue-funding/confirm_dark.png`}
          />
          <img
            className="border-gray-75 dark:border-polar-700 w-full max-w-2xl rounded-2xl border shadow-2xl"
            alt="Issue Funding Badge"
            src={`/assets/landing/issue-funding/confirm.png`}
          />
        </picture>
        <div className="dark:border-polar-700 flex flex-col divide-y overflow-hidden rounded-3xl border md:flex-row md:divide-x md:divide-y-0">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="hover:bg-gray-75 dark:hover:bg-polar-900 group relative flex flex-col transition-colors md:w-1/3"
            >
              <div className="flex h-full w-full flex-col gap-y-6 rounded-none border-none p-10">
                <h3 className="text-xl text-blue-500">0{index + 1}</h3>
                <div className="flex h-full flex-col gap-y-2 leading-relaxed">
                  <h3 className="text-xl">{step.title}</h3>
                  <p className="dark:text-polar-200 text-gray-500">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Separator />

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
