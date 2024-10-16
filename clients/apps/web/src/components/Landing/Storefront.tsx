'use client'

import { Organization, Product, ProductPrice } from '@polar-sh/sdk'
import { Checkout } from '../Checkout/Checkout'
import { createCheckoutPreview } from '../Customization/utils'
import { BrandingMenu } from '../Layout/Public/BrandingMenu'
import { Storefront } from '../Profile/Storefront'
import { StorefrontHeader } from '../Profile/StorefrontHeader'
import { OrganizationForm } from './Hero/Hero'
import { Section } from './Section'

const ORG: Organization = {
  id: 'xxxabc',
  created_at: new Date('2023-01-01T00:00:00Z').toISOString(),
  modified_at: null,
  name: 'Acme Corp',
  slug: 'acme',
  avatar_url: '/acme.jpg',
  pledge_minimum_amount: 2000,
  pledge_badge_show_amount: true,
  profile_settings: {
    enabled: true,
    accent_color: '#070708',
  },
  donations_enabled: false,
  feature_settings: {},
  default_upfront_split_to_contributors: null,
  bio: null,
  company: null,
  blog: null,
  location: null,
  email: null,
  twitter_username: null,
}

const SUBSCRIPTIONS: Partial<Product>[] = [
  {
    name: 'Basic',
    description:
      'Polar has no monthly fees. This tier is only an example of what you could offer your audience in minutes using Polar.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        modified_at: null,
        amount_type: 'fixed',
        price_amount: 900,
        price_currency: 'usd',
        type: 'recurring',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '456',
        description: 'Private GitHub repository',
        type: 'github_repository',
        created_at: new Date().toDateString(),
        modified_at: null,
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
    medias: [],
    created_at: new Date().toDateString(),
    is_recurring: true,
  },
  {
    name: 'Pro',
    description:
      'Polar has no monthly fees. This tier is only an example of what you could offer your audience in minutes using Polar.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        modified_at: null,
        amount_type: 'fixed',
        price_amount: 1900,
        price_currency: 'usd',
        type: 'recurring',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '456',
        description: 'Private GitHub repository',
        type: 'github_repository',
        created_at: new Date().toDateString(),
        modified_at: null,
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '789',
        description: 'Discord Support Channel',
        type: 'discord',
        created_at: new Date().toDateString(),
        modified_at: null,
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
    medias: [],
    created_at: new Date().toDateString(),
    is_recurring: true,
  },
  {
    name: 'Enterprise',
    description:
      'Polar has no monthly fees. This tier is only an example of what you could offer your audience in minutes using Polar.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        modified_at: null,
        amount_type: 'fixed',
        price_amount: 2900,
        price_currency: 'usd',
        type: 'recurring',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '456',
        description: 'Private GitHub repository',
        type: 'github_repository',
        created_at: new Date().toDateString(),
        modified_at: null,
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '789',
        description: 'Discord Support Channel',
        type: 'discord',
        created_at: new Date().toDateString(),
        modified_at: null,
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '852',
        description: 'License Key',
        type: 'license_keys',
        created_at: new Date().toDateString(),
        modified_at: null,
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
    medias: [],
    created_at: new Date().toDateString(),
    is_recurring: true,
  },
]

export const StorefrontSection = () => {
  return (
    <Section className="flex flex-col items-center gap-y-32 md:px-0 md:py-24">
      <div className="flex flex-col items-center gap-y-8 text-center">
        <h2 className="w-2/3 text-balance text-5xl leading-normal">
          Hosted Storefronts at your fingertips
        </h2>
        <p className="dark:text-polar-500 text-2xl">
          Launch your own branded storefront with a click of a button
        </p>
        <OrganizationForm />
      </div>
      <div className="relative flex h-[1420px] flex-col gap-y-24">
        <div className="dark:bg-polar-950 rounded-4xl dark:border-polar-700 flex origin-top scale-75 flex-col items-center gap-y-8 md:p-12 dark:border">
          <div className="flex flex-row items-center justify-center">
            <BrandingMenu />
          </div>
          <StorefrontHeader organization={ORG} />
          <Storefront
            organization={ORG}
            products={SUBSCRIPTIONS as Product[]}
            issues={[]}
          />
        </div>
        <div className="absolute left-0 right-0 top-[460px] z-20">
          <Checkout
            organization={ORG}
            checkout={createCheckoutPreview(
              SUBSCRIPTIONS[2] as Product,
              SUBSCRIPTIONS[2].prices?.[0] as ProductPrice,
            )}
          />
        </div>
      </div>
    </Section>
  )
}
