import { Product } from '@polar-sh/sdk'

export const MOCKED_PRODUCTS: Partial<Product>[] = [
  {
    name: 'Follower',
    type: 'free',
    description: 'A simple way to follow my projects.',

    benefits: [
      {
        id: '123',
        description: 'Weekly Newsletter',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
  },
  {
    name: 'Supporter',
    type: 'individual',
    description:
      'Access to my weekly newsletter, my private GitHub repository & invite to my Discord server.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        price_amount: 1900,
        price_currency: 'usd',
        type: 'recurring',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '123',
        description: 'Binary Downloads',
        type: 'downloadables',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '456',
        description: 'Access to GitHub repository',
        type: 'github_repository',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '789',
        description: 'Discord Invite',
        type: 'discord',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
  },
  {
    name: 'Enterprise',
    type: 'business',
    description:
      'Exclusive support, exposure in my weekly newsletter & premium role on Discord.',
    prices: [
      {
        id: '123',
        created_at: new Date().toDateString(),
        price_amount: 299900,
        price_currency: 'usd',
        type: 'recurring',
        recurring_interval: 'month',
        is_archived: false,
      },
    ],
    benefits: [
      {
        id: '123',
        description: 'Your logotype in Newsletter',
        type: 'articles',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '456',
        description: 'Access to GitHub repository',
        type: 'github_repository',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
      {
        id: '789',
        description: 'Premium Role on Discord',
        type: 'discord',
        created_at: new Date().toDateString(),
        selectable: false,
        deletable: false,
        organization_id: '123',
      },
    ],
  },
]
