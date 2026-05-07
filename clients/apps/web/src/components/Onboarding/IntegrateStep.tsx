import { useOnboardingTracking } from '@/hooks'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'
import slugify from 'slugify'
import LogoIcon from '../Brand/logos/LogoIcon'
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
  const router = useRouter()
  const { trackStepStarted, trackStepCompleted, trackCompleted, getSession } =
    useOnboardingTracking()

  useEffect(() => {
    const session = getSession()
    if (session) {
      trackStepStarted('integrate', organization.id)
    }
  }, [organization.id, getSession, trackStepStarted])

  const handleGoToDashboard = async () => {
    const session = getSession()
    if (session) {
      await trackStepCompleted('integrate', organization.id)
      await trackCompleted(organization.id)
    }
    router.push(`/dashboard/${organization.slug}`)
  }

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
    <Box
      display="flex"
      height="100%"
      flexDirection={{ base: 'column', md: 'row' }}
    >
      <Box
        display="flex"
        height="100%"
        minHeight={0}
        width="100%"
        flexDirection="column"
        gap="2xl"
        overflowY="auto"
        padding="3xl"
        maxWidth={{ md: '32rem' }}
        backgroundColor="background-card"
      >
        <Box display="flex" flexDirection="column" rowGap="3xl">
          <LogoIcon size={50} />
          <Box display="flex" flexDirection="column" rowGap="l">
            <h1 className="text-3xl">Integrate Checkout</h1>
            <p className="dark:text-polar-400 text-lg text-gray-600">
              Integrate checkouts with your favorite framework.
            </p>
          </Box>
        </Box>

        <Box
          display={{ base: 'none', md: 'flex' }}
          flexDirection="column"
          rowGap="2xl"
        >
          <Box
            display="grid"
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            gap="l"
          >
            {parsedFrameworks.map((framework) => (
              <FrameworkCard
                key={framework.slug}
                {...framework}
                active={selectedFramework === framework.slug}
                onClick={() => setSelectedFramework(framework.slug)}
              />
            ))}
          </Box>
          <Box display="flex" flexDirection="column" rowGap="l">
            <Link
              href={`https://polar.sh/docs/integrate/sdk/adapters/nextjs`}
              target="_blank"
              className="w-full"
            >
              <Button size="lg" fullWidth variant="secondary">
                <Box as="span">Explore All Adapters</Box>
                <ArrowOutwardOutlined className="ml-2" fontSize="small" />
              </Button>
            </Link>
            <Button size="lg" fullWidth onClick={handleGoToDashboard}>
              Go to Dashboard
            </Button>
          </Box>
        </Box>
      </Box>
      <SyntaxHighlighterProvider>
        <Box
          display={{ base: 'none', md: 'flex' }}
          flex={1}
          flexGrow={1}
          flexDirection="column"
          alignItems="center"
          gap="3xl"
          overflowY="auto"
          backgroundColor="background-secondary"
          padding="4xl"
        >
          <Box
            display="flex"
            width="100%"
            maxWidth="48rem"
            flexDirection="column"
            rowGap="3xl"
            borderRadius="xl"
            backgroundColor="background-card"
            padding="3xl"
          >
            <Box display="flex" flexDirection="column" rowGap="xl">
              <Box
                display="flex"
                flexDirection="row"
                alignItems="center"
                justifyContent="between"
              >
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
              </Box>
              <CodeWrapper>
                <SyntaxHighlighterClient lang="bash" code={installCommand} />
              </CodeWrapper>
            </Box>

            <Box display="flex" flexDirection="column" rowGap="xl">
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
            </Box>

            <Box display="flex" flexDirection="column" rowGap="xl">
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
                  <Box as="span">View Documentation</Box>
                  <ArrowOutwardOutlined className="ml-2" fontSize="small" />
                </Button>
              </Link>
            </Box>
          </Box>
        </Box>
      </SyntaxHighlighterProvider>
    </Box>
  )
}

const CodeWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box
      width="100%"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
      padding="l"
    >
      {children}
    </Box>
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
    <button type="button" onClick={() => onClick(slug)}>
      <Box
        cursor="pointer"
        display="flex"
        flexDirection="column"
        rowGap="l"
        borderRadius="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor={active ? 'border-secondary' : 'border-primary'}
        backgroundColor={active ? 'background-card' : 'background-secondary'}
        padding="l"
      >
        {icon ?? (
          <Box
            height={32}
            width={32}
            borderRadius="full"
            backgroundColor="background-secondary"
          />
        )}
        <h2 className="text-lg">{name}</h2>
      </Box>
    </button>
  )
}
