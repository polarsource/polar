export interface NavMenuLink {
  label: string
  href: string
  target?: '_blank'
}

export interface NavMenuSection {
  title: string
  items: NavMenuLink[]
}

export interface NavMenu {
  id: string
  title: string
  isActive?: (pathname: string) => boolean
  featured: NavMenuSection
  sections: NavMenuSection[]
}

export const navMenus: NavMenu[] = [
  {
    id: 'features',
    title: 'Features',
    isActive: (pathname) => pathname.startsWith('/features'),
    featured: {
      title: 'Explore Features',
      items: [
        { label: 'Usage Billing', href: '/features/usage-billing' },
        { label: 'Subscriptions', href: '/features/subscriptions' },
        { label: 'Merchant of Record', href: '/features/merchant-of-record' },
      ],
    },
    sections: [
      {
        title: 'More Features',
        items: [
          { label: 'Seats', href: '/features/seats' },
          { label: 'Credits', href: '/features/credits' },
          { label: 'Trials', href: '/features/trials' },
          { label: 'Discounts', href: '/features/discounts' },
          { label: 'Cost Insights', href: '/features/cost-insights' },
          { label: 'Finance', href: '/features/finance' },
        ],
      },
    ],
  },
  {
    id: 'docs',
    title: 'Docs',
    featured: {
      title: 'Explore Docs',
      items: [
        {
          label: 'Documentation',
          href: 'https://polar.sh/docs',
          target: '_blank',
        },
      ],
    },
    sections: [
      {
        title: 'Integrate',
        items: [
          {
            label: 'Next.js',
            href: '/docs/integrate/sdk/adapters/nextjs',
            target: '_blank',
          },
          {
            label: 'Better Auth',
            href: '/docs/integrate/sdk/adapters/better-auth',
            target: '_blank',
          },
          {
            label: 'Hono',
            href: '/docs/integrate/sdk/adapters/hono',
            target: '_blank',
          },
          {
            label: 'Laravel',
            href: '/docs/integrate/sdk/adapters/laravel',
            target: '_blank',
          },
          {
            label: 'All 13 Adapters',
            href: '/docs/integrate/sdk/adapters/hono',
            target: '_blank',
          },
        ],
      },
      {
        title: 'Features',
        items: [
          {
            label: 'Products & Subscriptions',
            href: '/docs/features/products',
            target: '_blank',
          },
          {
            label: 'Checkouts',
            href: '/docs/features/checkout/links',
            target: '_blank',
          },
          {
            label: 'Usage Billing',
            href: '/docs/features/usage-based-billing/introduction',
            target: '_blank',
          },
          {
            label: 'Benefits',
            href: '/docs/features/benefits',
            target: '_blank',
          },
          {
            label: 'Finance & Payouts',
            href: '/docs/features/finance/payouts',
            target: '_blank',
          },
        ],
      },
    ],
  },
]
