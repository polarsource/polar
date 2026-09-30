import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Chapter'
import { DocsLink } from './DocsLink'
import { Adapters } from './Adapters'
import { CodePanel } from './CodePanel'

const SDK_DOCS = '/docs/integrate/sdk/introduction'

const TYPESCRIPT = [
  "import { createPolar } from '@polar-sh/sdk/2026-04'",
  '',
  'const polar = createPolar({',
  '  accessToken: process.env.POLAR_ACCESS_TOKEN,',
  '})',
  '',
  '// every entitlement and balance, one call',
  "const state = await polar.customers.getStateExternal('lumen')",
]

const PYTHON = [
  'from polar.v2026_04 import Polar',
  '',
  'polar = Polar(os.environ["POLAR_ACCESS_TOKEN"])',
  '',
  '# every entitlement and balance, one call',
  'state = polar.customers.get_state_external("lumen")',
]

interface Client {
  name: string
  desc: string
  install: string
  caption: string
  lines: string[]
}

const CLIENTS: Client[] = [
  {
    name: 'TypeScript',
    desc: 'For Node, Bun, Deno and the browser. The import path pins your API version and everything after that is autocomplete.',
    install: 'npm install @polar-sh/sdk',
    caption: 'index.ts',
    lines: TYPESCRIPT,
  },
  {
    name: 'Python',
    desc: 'Sync and async clients for Django, Flask and FastAPI, typed end to end.',
    install: 'pip install polar-sdk',
    caption: 'main.py',
    lines: PYTHON,
  },
]

const Lead = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <Grid
    templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
    gap={{ base: 's', lg: 'l' }}
  >
    <Text variant="heading-xs" as="h3">
      {title}
    </Text>
    <Text variant="heading-xxs" as="p" color="muted" wrap="pretty">
      {description}
    </Text>
  </Grid>
)

export const Sdk = () => (
  <Chapter
    id="sdk"
    index="02"
    name="SDK"
    title="Built for your framework"
    subtitle="Typed clients underneath"
    description="Start with an adapter for your framework. Underneath sit the typed TypeScript and Python clients for everything else."
    cta={<DocsLink href={SDK_DOCS} label="SDK documentation" />}
  >
    <Box flexDirection="column" rowGap={{ base: '4xl', md: '5xl' }}>
      <Box flexDirection="column" rowGap={{ base: '2xl', md: '3xl' }}>
        <Lead
          title="Adapters"
          description="One file in your framework gives you a checkout route, a customer portal and verified webhooks. Pick yours to see the checkout handler."
        />
        <Adapters />
      </Box>
      <Box flexDirection="column" rowGap={{ base: '3xl', md: '4xl' }}>
        <Lead
          title="Clients"
          description="The adapters are built on these. Reach for them when you need the rest of the API."
        />
        {CLIENTS.map((client) => (
          <Grid
            key={client.name}
            templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
            gap={{ base: 'xl', lg: 'l' }}
          >
            <Box flexDirection="column" rowGap="l" maxWidth="32rem">
              <Box flexDirection="column" rowGap="s">
                <Text variant="heading-xs" as="h3">
                  {client.name}
                </Text>
                <Text variant="heading-xxs" as="p" color="muted" wrap="pretty">
                  {client.desc}
                </Text>
              </Box>
              <Box
                alignSelf="start"
                paddingVertical="s"
                paddingHorizontal="m"
                backgroundColor="background-secondary"
              >
                <Text variant="default" monospace>
                  {client.install}
                </Text>
              </Box>
            </Box>
            <CodePanel caption={client.caption} lines={client.lines} />
          </Grid>
        ))}
      </Box>
    </Box>
  </Chapter>
)
