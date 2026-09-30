import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Chapter'
import { CliInstall } from './CliInstall'
import { CodePanel } from './CodePanel'
import { DocsLink } from './DocsLink'

const CLI_DOCS = '/docs/integrate/webhooks/locally'

interface Command {
  command: string
  desc: string
}

const COMMANDS: Command[] = [
  {
    command: 'polar auth login --sandbox',
    desc: 'Sign in through the browser and pick an organization',
  },
  {
    command: 'polar listen http://localhost:3000/webhooks',
    desc: 'Webhooks tunneled to your machine, signed',
  },
  {
    command: 'polar trigger order.paid --override data.subtotal_amount=99900',
    desc: 'Fire any event with realistic fixtures, shaped how you need them',
  },
  {
    command: 'polar customers list --email=alice@example.com',
    desc: 'Every API resource as a command, in the active organization',
  },
  {
    command: 'polar update',
    desc: 'Signed builds for macOS, Linux and Windows',
  },
]

const TRANSCRIPT = [
  '% polar listen http://localhost:3000/webhooks',
  '',
  '  ✔ Select Organization … Lumen',
  '',
  '  Connected   Lumen',
  '  Forwarding  http://localhost:3000/webhooks',
  '  Waiting for events...',
  '',
  '% polar trigger order.paid --seed 7',
  '',
  '  order.paid               200  12ms',
  '',
  '% polar auth whoami --json',
  '',
  '  { "organization": { "slug": "lumen" }, ... }',
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
    desc: 'Auth, trigger and the API commands print JSON on request, so a coding agent can drive the CLI.',
  },
  {
    name: 'trigger --list',
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
    index="03"
    name="CLI"
    title="Localhost, wired in"
    subtitle="The whole API from the terminal"
    description="Sign in, tunnel webhooks, fire events and call any endpoint without leaving the terminal. Every command can speak JSON."
    cta={<DocsLink href={CLI_DOCS} label="CLI documentation" />}
  >
    <Box flexDirection="column" rowGap={{ base: '3xl', md: '4xl' }}>
      <CliInstall />
      <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap="l">
        <Box as="ul" flexDirection="column">
          {COMMANDS.map((item) => (
            <Box
              as="li"
              key={item.command}
              display="block"
              paddingVertical="l"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Box flexDirection="column" rowGap="xs">
                <Text variant="default" monospace>
                  {item.command}
                </Text>
                <Text variant="body" as="p" color="muted" wrap="pretty">
                  {item.desc}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
        <CodePanel caption="zsh" lines={TRANSCRIPT} />
      </Grid>
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
