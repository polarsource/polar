import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { withOffsets } from '@/utils/lines'
import { Chapter } from '../Chapter'
import { WindowFrame } from '../story/Frame'
import { FrameSheet, ImageBand } from './Backdrop'
import { DocsLink } from './DocsLink'

const CLI_DOCS = '/docs/integrate/webhooks/locally'

const TRANSCRIPT = [
  '% curl -fsSL https://polar.sh/install.sh | bash',
  '',
  '% polar webhook listen http://localhost:3000/api/webhooks',
  '',
  '  ● Connected  Acme',
  '  Forwarding  http://localhost:3000/api/webhooks',
  '  Waiting for events...',
  '',
  '% polar webhook trigger order.paid --seed 7',
  '',
  '  order.paid               200  12ms',
  '',
  '% polar auth whoami --json',
  '',
  '  { "source": "session", "organization": { "slug": "acme", ... } }',
]

interface Feature {
  name: string
  title: string
  desc: string
}

const FEATURES: Feature[] = [
  {
    name: '--json',
    title: 'Built for agents',
    desc: 'Auth, webhook and the API commands print JSON on request, so a coding agent can drive the CLI.',
  },
  {
    name: 'webhook trigger --list',
    title: 'Every event',
    desc: 'The full webhook catalog with descriptions. Pick one interactively or pass it by name.',
  },
  {
    name: '--override  --seed',
    title: 'Shaped fixtures',
    desc: 'Change any field in the payload and get the same IDs on every run.',
  },
  {
    name: '21 resources',
    title: 'The API, as commands',
    desc: 'Customers, products, subscriptions, orders, meters and more, generated from the OpenAPI spec.',
  },
]

export const Cli = () => (
  <Chapter
    id="cli"
    name="03 CLI"
    title="Localhost, wired in"
    subtitle="The whole API from the terminal"
    description="Sign in, tunnel webhooks, fire events and call any endpoint without leaving the terminal. Every command can speak JSON."
    cta={<DocsLink href={CLI_DOCS} label="CLI documentation" />}
  >
    <Box flexDirection="column" rowGap={{ base: '3xl', md: '4xl' }}>
      <ImageBand
        src="/assets/landing/company/Polar_Flow_02_No_Logo.jpg"
        className="min-h-[20rem] md:min-h-[28rem]"
      >
        <WindowFrame aside="zsh" className="max-w-[42rem]">
          <FrameSheet>
            <div className="overflow-x-auto font-mono text-[13px] leading-6 whitespace-pre">
              {withOffsets(TRANSCRIPT).map(({ line, offset }) =>
                line.startsWith('% ') ? (
                  <div key={offset} className="text-white">
                    <span className="text-polar-500">% </span>
                    {line.slice(2)}
                  </div>
                ) : (
                  <div key={offset} className="text-polar-300">
                    {line || <br />}
                  </div>
                ),
              )}
            </div>
          </FrameSheet>
        </WindowFrame>
      </ImageBand>
      <Grid
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          xl: 'repeat(4, 1fr)',
        }}
        gap="l"
      >
        {FEATURES.map((feature) => (
          <Box
            key={feature.name}
            flexDirection="column"
            rowGap="xl"
            padding="xl"
            borderRadius="m"
            backgroundColor="background-secondary"
          >
            <Text variant="default" color="muted" monospace>
              {feature.name}
            </Text>
            <Box flexDirection="column" rowGap="s">
              <Text variant="heading-xxs" as="h3">
                {feature.title}
              </Text>
              <Text variant="body" color="muted" wrap="pretty">
                {feature.desc}
              </Text>
            </Box>
          </Box>
        ))}
      </Grid>
    </Box>
  </Chapter>
)
