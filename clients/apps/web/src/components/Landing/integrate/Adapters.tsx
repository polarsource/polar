import { type Snippet, SnippetPicker } from './SnippetPicker'

const ADAPTER_DOCS = '/docs/integrate/sdk/adapters'

const ADAPTERS: Snippet[] = [
  {
    name: 'Next.js',
    caption: 'app/checkout/route.ts',
    href: `${ADAPTER_DOCS}/nextjs`,
    lines: [
      "import { Checkout } from '@polar-sh/nextjs'",
      '',
      'export const GET = Checkout({',
      '  accessToken: process.env.POLAR_ACCESS_TOKEN,',
      "  successUrl: 'https://myapp.com/welcome',",
      '})',
    ],
  },
  {
    name: 'Nuxt',
    caption: 'server/routes/api/checkout.get.ts',
    href: `${ADAPTER_DOCS}/nuxt`,
    lines: [
      'export default defineEventHandler((event) => {',
      '  const { polarAccessToken } = useRuntimeConfig().private',
      '',
      '  return Checkout({',
      '    accessToken: polarAccessToken,',
      "    successUrl: 'https://myapp.com/welcome',",
      '  })(event)',
      '})',
    ],
  },
  {
    name: 'TanStack Start',
    caption: 'routes/api/checkout.ts',
    href: `${ADAPTER_DOCS}/tanstack-start`,
    lines: [
      "import { Checkout } from '@polar-sh/tanstack-start'",
      "import { createFileRoute } from '@tanstack/react-router'",
      '',
      "export const Route = createFileRoute('/api/checkout')({",
      '  server: {',
      '    handlers: {',
      '      GET: Checkout({',
      '        accessToken: process.env.POLAR_ACCESS_TOKEN,',
      "        successUrl: 'https://myapp.com/welcome',",
      '      }),',
      '    },',
      '  },',
      '})',
    ],
  },
  {
    name: 'Better Auth',
    caption: 'auth.ts',
    href: `${ADAPTER_DOCS}/better-auth`,
    lines: [
      "import { polar, checkout, portal } from '@polar-sh/better-auth'",
      '',
      'export const auth = betterAuth({',
      '  plugins: [',
      '    polar({',
      '      client: polarClient,',
      '      createCustomerOnSignUp: true,',
      '      use: [',
      "        checkout({ products: [{ productId: '…', slug: 'pro' }] }),",
      '        portal(),',
      '      ],',
      '    }),',
      '  ],',
      '})',
    ],
  },
]

export const Adapters = () => (
  <SnippetPicker
    snippets={ADAPTERS}
    backdrop="/assets/landing/company/polar.jpg"
  />
)
