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

export const product: DeepPartial<schemas['Product']> = {
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
