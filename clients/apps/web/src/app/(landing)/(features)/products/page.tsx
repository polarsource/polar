import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { FeatureSection } from '@/components/Landing/FeatureSection'
import { PageContent } from '@/components/Landing/LandingPage'
import { Section } from '@/components/Landing/Section'
import { Circles } from '@/components/Landing/molecules/Circles'
import { MOCKED_PRODUCTS } from '@/components/Landing/utils'
import { ProductCard } from '@/components/Products/ProductCard'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { Product, UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { Separator } from 'polarkit/components/ui/separator'

const PAGE_TITLE = 'Products & Subscriptions'
const PAGE_DESCRIPTION =
  'Offer paid subscription tiers or one-time purchases with associated benefits'

export default function Page() {
  return (
    <>
      <Section className="relative flex flex-col gap-16 md:flex-row md:justify-between md:py-24">
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
        <div className="relative grid grid-cols-1 gap-4 md:w-1/2 md:grid-cols-2">
          <div className="shadow-3xl overflow-hidden rounded-3xl">
            <ProductCard product={MOCKED_PRODUCTS[3] as Product} />
          </div>
          <SubscriptionTierCard
            className="dark:bg-polar-950 shadow-3xl w-full max-w-[280px]"
            subscriptionTier={MOCKED_PRODUCTS[1]}
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
            alt="Products & Subscriptions"
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

      <Separator />

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
