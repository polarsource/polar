import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { PageContent } from '@/components/Landing/LandingPage'
import { Section } from '@/components/Landing/Section'
import { ArrowForward } from '@mui/icons-material'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { Separator } from 'polarkit/components/ui/separator'
import { PropsWithChildren } from 'react'

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

      <Section
        className="flex flex-col-reverse gap-16 md:flex-row md:justify-between md:gap-32 md:py-24"
        wrapperClassName="bg-gray-75 dark:bg-polar-900"
      >
        <picture className="md:w-1/2">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={`/assets/landing/issue-funding/funding_modal_dark.png`}
          />
          <img
            className="border-gray-75 dark:border-polar-700 rounded-2xl border shadow-sm"
            alt="Issue Funding Badge"
            src={`/assets/landing/issue-funding/funding_modal.png`}
          />
        </picture>
        <div className="flex flex-col gap-y-6 md:w-1/2">
          <div className="flex flex-col gap-y-4">
            <h1 className="text-2xl md:text-4xl md:leading-snug">
              Seamlessly badge issues
            </h1>
            <p className="dark:text-polar-200 text-lg text-gray-500 md:text-xl md:leading-normal">
              Promote funding on your GitHub issues without any manual overhead
            </p>
          </div>
          <ul className="flex flex-col gap-y-2">
            <ListItem>Customize the Embed</ListItem>
            <ListItem>Set optional funding goal</ListItem>
            <ListItem>Target issues using the Polar label</ListItem>
            <ListItem>Deploy the embed on issues automatically</ListItem>
          </ul>
        </div>
      </Section>

      <Section className="flex flex-col gap-16 md:flex-row md:justify-between md:gap-32 md:py-24">
        <div className="flex flex-col gap-y-6 md:w-1/2">
          <div className="flex flex-col gap-y-4">
            <h1 className="text-2xl md:text-4xl md:leading-snug">
              Contributor Rewards
            </h1>
            <p className="dark:text-polar-200 text-lg text-gray-500 md:text-xl md:leading-normal">
              Reward contributors who help you fix your GitHub issues
            </p>
          </div>
          <ul className="flex flex-col gap-y-2">
            <ListItem>Setup rewards for contributors</ListItem>
            <ListItem>
              Adjust individual rewards before transferring funds
            </ListItem>
            <ListItem>Boost rewards by funding the issue yourself</ListItem>
          </ul>
        </div>
        <picture className="md:w-1/2">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={`/assets/landing/issue-funding/rewards_dark.png`}
          />
          <img
            className="border-gray-75 dark:border-polar-700 rounded-2xl border shadow-sm"
            alt="Issue Funding Badge"
            src={`/assets/landing/issue-funding/rewards.png`}
          />
        </picture>
      </Section>

      <Section
        className="flex flex-col-reverse gap-16 md:flex-row md:justify-between md:gap-32 md:py-24"
        wrapperClassName="bg-gray-75 dark:bg-polar-900"
      >
        <picture className="md:w-1/2">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={`/assets/landing/issue-funding/completed_dark.png`}
          />
          <img
            className="border-gray-75 dark:border-polar-700 rounded-2xl border shadow-sm"
            alt="Issue Funding Badge"
            src={`/assets/landing/issue-funding/completed.png`}
          />
        </picture>
        <div className="flex flex-col gap-y-6 md:w-1/2">
          <div className="flex flex-col gap-y-4">
            <h1 className="text-2xl md:text-4xl md:leading-snug">
              Crowdfunded Backlog
            </h1>
            <p className="dark:text-polar-200 text-lg text-gray-500 md:text-xl md:leading-normal">
              Automatically synced with your GitHub issues
            </p>
          </div>
          <ul className="flex flex-col gap-y-2">
            <ListItem>A dashboard overview of your funded issues</ListItem>
            <ListItem>Promote your funded issues on the Public Page</ListItem>
          </ul>
        </div>
      </Section>

      <Section className="flex flex-col items-center gap-16 md:gap-24 md:py-24">
        <h1 className="px-16 text-center text-4xl leading-snug">
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
                <h3 className="font-mono text-xl text-blue-500">
                  0{index + 1}.
                </h3>
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

const ListItem = ({ children }: PropsWithChildren) => {
  return (
    <li className="flex flex-row gap-x-2 leading-snug">
      <ArrowForward fontSize="small" />
      <span>{children}</span>
    </li>
  )
}

export const metadata = {
  title: 'Issue Funding',
  description: PAGE_DESCRIPTION,
  openGraph: {
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    description: PAGE_DESCRIPTION,
  },
}
