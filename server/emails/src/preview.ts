import { schemas } from './types'

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

export const organization: Partial<schemas['Organization']> = {
  name: 'Acme Inc.',
  slug: 'acme-inc',
  avatar_url:
    'https://polar-public-sandbox-files.s3.amazonaws.com/organization_avatar/b3281d01-7b90-4a5b-8225-e8e150f4009c/9e5f848b-8b1d-4592-9fe1-7cad2cfa53ee/unicorn-dev-logo.png',
  website: 'https://www.example.com',
}

export const product: DeepPartial<schemas['ProductEmail']> = {
  name: 'Premium Subscription',
  benefits: [
    {
      id: 'benefit-1',
      type: 'custom',
      description: 'Access to premium features',
      properties: {
        note: `
I'm a dense thank you note with:

* Bullet points
* **Bold text**
* _Italic text_
* [Links](https://www.example.com)
        `,
      },
    },
    {
      id: 'benefit-2',
      type: 'discord',
      description: 'Join our exclusive Discord community',
      properties: {},
    },
    {
      id: 'benefit-3',
      type: 'github_repository',
      description: 'Access to private GitHub repositories',
      properties: {},
    },
    {
      id: 'benefit-4',
      type: 'downloadables',
      description: 'Download exclusive resources',
      properties: {},
    },
    {
      id: 'benefit-5',
      type: 'license_keys',
      description: 'Receive license keys for our software',
      properties: {},
    },
    {
      id: 'benefit-6',
      type: 'meter_credit',
      description: 'Get meter credits for additional usage',
      properties: {},
    },
  ],
}

export const order: DeepPartial<schemas['OrderEmail']> = {
  status: 'paid',
  paid: true,
  invoice_number: 'INV-2024-001',
  created_at: '2024-01-15T10:30:00Z',
  subtotal_amount: 9900, // $99.00
  discount_amount: 1000, // $10.00 discount
  net_amount: 8900,
  tax_amount: 712, // $7.12 tax
  total_amount: 9612, // $96.12 total
  applied_balance_amount: -500, // $5.00 credit applied
  due_amount: 9112, // $91.12 due after credit
  refunded_amount: 0,
  refunded_tax_amount: 0,
  currency: 'usd',
  billing_reason: 'purchase',
  billing_name: 'John Doe',
  billing_address: {
    line1: '123 Main Street',
    line2: 'Apt 4B',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94105',
    country: 'US',
  },
  subscription_id: null,
  items: [
    {
      id: 'item-1',
      label: 'Premium Plan - Lifetime Access',
      amount: 8900, // After discount
      proration: false,
      product_price_id: 'price123',
    },
    {
      id: 'item-2',
      label: 'Setup Fee',
      amount: 1000,
      proration: false,
      product_price_id: 'price456',
    },
  ],
}
