import { OrganizationContext } from '@/providers/maintainerOrganization'
import { ArrowOutwardOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { useContext, useState } from 'react'
import slugify from 'slugify'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '../Brand/LogoIcon'
import BetterAuthIcon from '../Icons/frameworks/better-auth'
import NextJsIcon from '../Icons/frameworks/nextjs'
import NodeJsIcon from '../Icons/frameworks/nodejs'
import PythonIcon from '../Icons/frameworks/python'
import OrganizationAccessTokensSettings from '../Settings/OrganizationAccessTokensSettings'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

const frameworks = (product: schemas['Product']) =>
  [
    {
      slug: 'nextjs',
      name: 'Next.js',
      link: 'https://docs.polar.sh/integrate/sdk/adapters/nextjs',
      icon: <NextJsIcon size={24} />,
      install: 'pnpm add @polar-sh/nextjs',
      code: `import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: process.env.SUCCESS_URL
});`,
    },
    {
      slug: 'better-auth',
      name: 'BetterAuth',
      link: 'https://docs.polar.sh/integrate/sdk/adapters/better-auth',
      icon: <BetterAuthIcon size={24} />,
      install: 'pnpm add better-auth @polar-sh/better-auth @polar-sh/sdk',
      code: `import { betterAuth } from "better-auth";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const polarClient = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: 'sandbox'
});

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
                checkout({
                    products: [
                        {
                            productId: "${product.id}",
                            slug: "${slugify(product.name)}" // Custom slug for easy reference in Checkout URL, e.g. /checkout/${slugify(product.name)}
                        }
                    ],
                    successUrl: "/success?checkout_id={CHECKOUT_ID}",
                    authenticatedUsersOnly: true
                })
            ],
        })
    ]
});`,
    },
    {
      slug: 'nodejs',
      name: 'Node.js',
      link: 'https://docs.polar.sh/integrate/sdk/typescript',
      icon: <NodeJsIcon size={24} />,
      install: 'pnpm add @polar-sh/sdk',
      code: `import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: 'xxx',
});

const checkout = await polar.checkouts.create({
  products: ["${product.id}"]
});

redirect(checkout.url)`,
    },
    {
      slug: 'python',
      name: 'Python',
      link: 'https://docs.polar.sh/integrate/sdk/python',
      icon: <PythonIcon size={24} />,
      install: 'pip install polar-sdk',
      code: `from polar_sdk import Polar


with Polar(
    access_token="<YOUR_BEARER_TOKEN_HERE>",
) as polar:

    res = polar.checkouts.create(request={
        "products": [
            "${product.id}"
        ],
    })

    # Handle response
    redirect(res.url)`,
    },
  ] as const

export interface IntegrateStepProps {
  product: schemas['Product']
}

export const IntegrateStep = ({ product }: IntegrateStepProps) => {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(
    'nextjs',
  )

  const { organization } = useContext(OrganizationContext)

  const currentFramework = frameworks(product).find(
    (framework) => framework.slug === selectedFramework,
  )

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex h-full min-h-0 w-full flex-col gap-12 overflow-y-auto p-12 md:max-w-lg">
        <div className="flex flex-col gap-y-12">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-3xl">Integrate Checkout</h1>
            <p className="dark:text-polar-400 text-lg text-gray-600">
              Integrate checkouts with your favorite framework.
            </p>
          </div>
        </div>
        <div className="flex flex-row gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={twMerge(
                'dark:bg-polar-700 flex h-2 flex-1 rounded-full bg-gray-300',
                index < 3 && 'bg-black dark:bg-white',
              )}
            />
          ))}
        </div>
        <div className="hidden flex-col gap-y-6 md:flex">
          <div className="grid grid-cols-2 gap-4">
            {frameworks(product).map((framework) => (
              <FrameworkCard
                key={framework.slug}
                {...framework}
                active={selectedFramework === framework.slug}
                onClick={() => setSelectedFramework(framework.slug)}
              />
            ))}
          </div>
          <Link
            href={`https://docs.polar.sh/integrate/sdk/adapters/nextjs`}
            target="_blank"
            className="w-full"
          >
            <Button size="lg" fullWidth variant="secondary">
              <span>Explore All Adapters</span>
              <ArrowOutwardOutlined className="ml-2" fontSize="small" />
            </Button>
          </Link>
        </div>
        <Link href={`/dashboard/${organization.slug}`} className="w-full">
          <Button size="lg" fullWidth>
            Go to Dashboard
          </Button>
        </Link>
      </div>
      <SyntaxHighlighterProvider>
        <div className="dark:bg-polar-800 hidden flex-1 flex-grow flex-col items-center gap-12 overflow-y-auto bg-gray-100 p-16 md:flex">
          <div className="dark:bg-polar-900 flex w-full max-w-3xl flex-col gap-y-12 rounded-3xl bg-white p-12">
            <div className="flex flex-col items-center gap-y-6 text-center">
              <LogoIcon size={40} />
              <div className="flex flex-col gap-y-4">
                <h1 className="text-3xl">Integrate Checkout</h1>
                <p className="dark:text-polar-500 text-lg text-gray-500">
                  Follow the instructions below to integrate Checkout into your
                  application.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-y-6">
              <h2 className="text-lg">1. Install Dependencies</h2>
              <CodeWrapper>
                <SyntaxHighlighterClient
                  lang="bash"
                  code={
                    frameworks(product).find(
                      (framework) => framework.slug === selectedFramework,
                    )?.install ?? ''
                  }
                />
              </CodeWrapper>
            </div>

            <div className="flex flex-col gap-y-6">
              <h2 className="text-lg">2. Add Environment Variables</h2>
              <OrganizationAccessTokensSettings organization={organization} />
              <CodeWrapper>
                <SyntaxHighlighterClient
                  lang="bash"
                  code={`# .env
POLAR_ACCESS_TOKEN=XXX
POLAR_SUCCESS_URL=https://my-app.com/success?checkout_id={CHECKOUT_ID}`}
                />
              </CodeWrapper>
            </div>

            <div className="flex flex-col gap-y-6">
              <h2 className="text-lg">3. Integrate the Checkout</h2>
              <CodeWrapper>
                <SyntaxHighlighterClient
                  lang={
                    currentFramework?.slug === 'python'
                      ? 'python'
                      : 'typescript'
                  }
                  code={currentFramework?.code ?? ''}
                />
              </CodeWrapper>
              <Link href={currentFramework?.link ?? ''} target="_blank">
                <Button size="lg" variant="secondary" fullWidth>
                  <span>View Documentation</span>
                  <ArrowOutwardOutlined className="ml-2" fontSize="small" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </SyntaxHighlighterProvider>
    </div>
  )
}

const CodeWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="dark:border-polar-700 dark:bg-polar-800 w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
      {children}
    </div>
  )
}

export interface FrameworkCardProps {
  slug: string
  name: string
  icon?: React.ReactNode
  active: boolean
  onClick: (framework: string) => void
}

const FrameworkCard = ({
  name,
  slug,
  icon,
  active,
  onClick,
}: FrameworkCardProps) => {
  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 flex flex-col gap-y-4 rounded-xl border border-transparent bg-gray-100 p-4',
        active
          ? 'shadow-3xl border-gray-100 bg-blue-500 text-white'
          : 'transition-opacity hover:opacity-70',
      )}
      role="button"
      onClick={() => onClick(slug)}
    >
      {icon ?? (
        <div className="dark:bg-polar-900 h-8 w-8 rounded-full bg-gray-200" />
      )}
      <h2 className="text-lg">{name}</h2>
    </div>
  )
}
