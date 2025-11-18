import { schemas } from '@polar-sh/client'

export const MOCKED_WEBSITE_SUBSCRIPTION: Partial<
  schemas['ProductStorefront']
> = {
  name: 'Just an Example',
  description:
    'Polar has no monthly fees. This tier is only an example of what you could offer your audience in minutes using Polar.',
  prices: [
    {
      id: '123',
      created_at: new Date().toDateString(),
      modified_at: null,
      source: 'catalog',
      amount_type: 'fixed',
      price_amount: 900,
      price_currency: 'usd',
      type: 'recurring',
      recurring_interval: 'month',
      is_archived: false,
      product_id: '123',
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
    {
      id: '123',
      description: 'Binary Downloads',
      type: 'downloadables',
      created_at: new Date().toDateString(),
      modified_at: null,
      selectable: false,
      deletable: false,
      organization_id: '123',
    },
  ],
  created_at: new Date().toDateString(),
}
