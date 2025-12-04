import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useContext, useMemo, useState } from 'react'
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

const packageManagers = ['pnpm', 'npm', 'yarn', 'bun'] as const
type PackageManager = (typeof packageManagers)[number]

const getInstallCommand = (
  packages: string,
  packageManager: PackageManager,
): string => {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm add ${packages}`
    case 'npm':
      return `npm install ${packages}`
    case 'yarn':
      return `yarn add ${packages}`
    case 'bun':
      return `bun add ${packages}`
  }
}

const frameworks = (products: schemas['Product'][]) =>
  [
    {
      slug: 'nextjs',
      name: 'Next.js',
      link: 'https://polar.sh/docs/integrate/sdk/adapters/nextjs',
      icon: <NextJsIcon size={24} />,
      packages: '@polar-sh/nextjs',
      code: `import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  successUrl: process.env.POLAR_SUCCESS_URL
});`,
    },
    {
      slug: 'better-auth',
      name: 'BetterAuth',
      link: 'https://polar.sh/docs/integrate/sdk/adapters/better-auth',
      icon: <BetterAuthIcon size={24} />,
      packages: 'better-auth @polar-sh/better-auth @polar-sh/sdk',
      code: `import { betterAuth } from "better-auth";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const polarClient = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN
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
${products
  .map(
    (p) => `                        {
                            productId: "${p.id}",
                            slug: "${slugify(p.name)}" // Custom slug for easy reference in Checkout URL, e.g. /checkout/${slugify(p.name)}
                        }`,
  )
  .join(',\n')}
                    ],
                    successUrl: process.env.POLAR_SUCCESS_URL,
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
      link: 'https://polar.sh/docs/integrate/sdk/typescript',
      icon: <NodeJsIcon size={24} />,
      packages: '@polar-sh/sdk',
      code: `import { Polar } from "@polar-sh/sdk";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
});

const checkout = await polar.checkouts.create({
  products: [
${products.map((p) => `    "${p.id}"`).join(',\n')}
  ],
  successUrl: process.env.POLAR_SUCCESS_URL
});

redirect(checkout.url)`,
    },
    {
      slug: 'python',
      name: 'Python',
      link: 'https://polar.sh/docs/integrate/sdk/python',
      icon: <PythonIcon size={24} />,
      pythonInstall: 'pip install polar-sdk',
      code: `import os
from polar_sdk import Polar

with Polar(
    access_token=os.environ.get("POLAR_ACCESS_TOKEN"),
) as polar:

    res = polar.checkouts.create(request={
        "products": [
${products.map((p) => `            "${p.id}"`).join(',\n')}
        ],
        "success_url": os.environ.get("POLAR_SUCCESS_URL")
    })

    # Handle response
    redirect(res.url)`,
    },
  ] as const

export interface IntegrateStepProps {
  products: schemas['Product'][]
}

export const IntegrateStep = ({ products }: IntegrateStepProps) => {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(
    'nextjs',
  )
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm')

  const { organization } = useContext(OrganizationContext)

  const parsedFrameworks = useMemo(() => frameworks(products), [products])

  const currentFramework = useMemo(
    () =>
      parsedFrameworks.find(
        (framework) => framework.slug === selectedFramework,
      ),
    [parsedFrameworks, selectedFramework],
  )

  const installCommand = useMemo(() => {
    if (!currentFramework) return ''
    if ('pythonInstall' in currentFramework && currentFramework.pythonInstall) {
      return currentFramework.pythonInstall
    }
    if ('packages' in currentFramework && currentFramework.packages) {
      return getInstallCommand(currentFramework.packages, packageManager)
    }
    return ''
  }, [currentFramework, packageManager])

  const isPython = currentFramework?.slug === 'python'

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="dark:bg-polar-900 flex h-full min-h-0 w-full flex-col gap-8 overflow-y-auto p-12 md:max-w-lg">
        <div className="flex flex-col gap-y-12">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-3xl">Integrate Checkout</h1>
            <p className="dark:text-polar-400 text-lg text-gray-600">
              Integrate checkouts with your favorite framework.
            </p>
          </div>
        </div>

        <div className="hidden flex-col gap-y-8 md:flex">
          <div className="grid grid-cols-2 gap-4">
            {parsedFrameworks.map((framework) => (
              <FrameworkCard
                key={framework.slug}
                {...framework}
                active={selectedFramework === framework.slug}
                onClick={() => setSelectedFramework(framework.slug)}
              />
            ))}
          </div>
          <div className="flex flex-col gap-y-4">
            <Link
              href={`https://polar.sh/docs/integrate/sdk/adapters/nextjs`}
              target="_blank"
              className="w-full"
            >
              <Button size="lg" fullWidth variant="secondary">
                <span>Explore All Adapters</span>
                <ArrowOutwardOutlined className="ml-2" fontSize="small" />
              </Button>
            </Link>
            <Link href={`/dashboard/${organization.slug}`} className="w-full">
              <Button size="lg" fullWidth>
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <SyntaxHighlighterProvider>
        <div className="dark:bg-polar-950 hidden flex-1 grow flex-col items-center gap-12 overflow-y-auto bg-gray-100 p-16 md:flex">
          <div className="dark:bg-polar-900 flex w-full max-w-3xl flex-col gap-y-12 rounded-3xl bg-white p-12">
            <div className="flex flex-col gap-y-6">
              <div className="flex flex-row items-center justify-between">
                <h2 className="text-lg">1. Install Dependencies</h2>
                {!isPython && (
                  <Tabs
                    value={packageManager}
                    onValueChange={(v) =>
                      setPackageManager(v as PackageManager)
                    }
                  >
                    <TabsList className="dark:bg-polar-800 rounded-sm bg-gray-100 p-0.5">
                      {packageManagers.map((pm) => (
                        <TabsTrigger
                          key={pm}
                          value={pm}
                          className="dark:data-[state=active]:bg-polar-700 !rounded-sm px-2.5 py-1 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                        >
                          {pm}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
              </div>
              <CodeWrapper>
                <SyntaxHighlighterClient lang="bash" code={installCommand} />
              </CodeWrapper>
            </div>

            <div className="flex flex-col gap-y-6">
              <h2 className="text-lg">2. Add Environment Variables</h2>
              <OrganizationAccessTokensSettings
                organization={organization}
                singleTokenMode
                minimal
                onTokenCreated={setCreatedToken}
              />
              <CodeWrapper>
                <SyntaxHighlighterClient
                  lang="bash"
                  code={`POLAR_ACCESS_TOKEN=${createdToken ?? 'XXX'}
POLAR_SUCCESS_URL=https://example.com/success?checkout_id={CHECKOUT_ID}`}
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
        'dark:bg-polar-800 dark:border-polar-700 flex cursor-pointer flex-col gap-y-4 rounded-xl border border-transparent bg-gray-100 p-4',
        active
          ? 'shadow-3xl border-gray-100 bg-black text-white dark:bg-white dark:text-black'
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
