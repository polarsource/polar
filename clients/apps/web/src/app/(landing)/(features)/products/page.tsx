import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { FeatureSection } from '@/components/Landing/FeatureSection'
import { PageContent } from '@/components/Landing/LandingPage'
import { Section } from '@/components/Landing/Section'
import { MOCKED_PRODUCTS } from '@/components/Landing/utils'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { SelectSeparator } from 'polarkit/components/ui/atoms/select'

const PAGE_TITLE = 'Products & Subscriptions'
const PAGE_DESCRIPTION =
  'Offer paid subscription tiers or one-time purchases with associated benefits'

export default function Page() {
  return (
    <>
      <Section className="flex flex-col gap-16 md:flex-row md:justify-between md:py-24">
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
        <div className="grid grid-cols-1 gap-4 md:w-1/2 md:grid-cols-2">
          <SubscriptionTierCard
            className="shadow-sm"
            subscriptionTier={MOCKED_PRODUCTS[1]}
          />
          <SubscriptionTierCard
            className="shadow-sm"
            subscriptionTier={MOCKED_PRODUCTS[2]}
          />
        </div>
      </Section>
      <Section
        className="md:py-24"
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
      >
        <picture className="w-full">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet="assets/landing/subscriptions/subscriptions_dark.png"
          />
          <img
            className="border-gray-75 dark:border-polar-700 rounded-3xl border shadow-2xl"
            alt="Issue Funding Badge"
            src="/assets/landing/subscriptions/subscriptions.png"
          />
        </picture>
      </Section>
      <FeatureSection
        title="Subscriptions"
        description="Recurring funding for your projects"
        features={[
          'Sell access to exclusive content on a recurring basis',
          'Customize your subscription tiers',
          'Metrics on your subscription sales & revenue',
        ]}
        media={{
          light: '/assets/landing/subscriptions/products.jpg',
          dark: '/assets/landing/subscriptions/products_dark.jpg',
        }}
      />

      <SelectSeparator />

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="One-time Purchases"
        description="Sell products or services as one-time purchases"
        features={[
          'Sell access to exclusive content once',
          'Customize your product offerings',
          'Metrics on sales & revenue',
        ]}
        media={{
          light: '/assets/landing/subscriptions/products.jpg',
          dark: '/assets/landing/subscriptions/products_dark.jpg',
        }}
        direction="row-reverse"
      />

      <SelectSeparator />

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
