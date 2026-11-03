import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Chapter'
import { DocsLink } from './DocsLink'
import { AgentsFigure, type Turn } from '../story/AgentsFigure'
import { ConnectPanel } from './ConnectPanel'

const MCP_DOCS = '/docs/integrate/mcp'

interface Tool {
  name: string
  title: string
  desc: string
}

const TOOLSET: Tool[] = [
  {
    name: 'search_tools',
    title: 'Search',
    desc: 'The agent describes what it wants to do and gets back the operations that fit.',
  },
  {
    name: 'describe_tools',
    title: 'Inspect',
    desc: 'It loads the exact inputs for the best matches, and nothing else.',
  },
  {
    name: 'execute_tool',
    title: 'Execute',
    desc: 'It runs the operation with validated arguments and reads the result.',
  },
  {
    name: '100 operations',
    title: 'Everything underneath',
    desc: 'Products, customers, subscriptions, orders, benefits, refunds and metrics.',
  },
]

/** The landing's agent session, opening with the integration itself. */
const TURNS: Turn[] = [
  {
    prompt: 'Integrate Polar for billing in my stack',
    tool: 'Create product',
    answer:
      'Added the Next.js adapter with checkout, the customer portal and verified webhooks, and created a Pro product in your sandbox.',
  },
  {
    prompt: 'How much usage has Acme run up this cycle?',
    tool: 'Get customer state by external ID',
    answer:
      'Acme is on Business with 9.2B tokens metered. They used all 40,000 credits and $1,284 of usage on top.',
  },
]

export const Mcp = () => (
  <Chapter
    id="mcp"
    name="01 MCP"
    title="Agents included"
    subtitle="Polar as a tool your agent can call"
    description="A remote MCP server with OAuth, so there are no keys to paste. Three meta-tools keep the context small, so the agent only loads the operations it needs."
    cta={<DocsLink href={MCP_DOCS} label="MCP documentation" />}
  >
    <Box flexDirection="column" rowGap={{ base: '3xl', md: '4xl' }}>
      <AgentsFigure turns={TURNS} />
      <Grid
        templateColumns={{
          base: '1fr',
          md: 'repeat(2, 1fr)',
          xl: 'repeat(4, 1fr)',
        }}
        gap="l"
      >
        {TOOLSET.map((tool) => (
          <Box
            key={tool.name}
            flexDirection="column"
            rowGap="xl"
            padding="xl"
            borderRadius="m"
            backgroundColor="background-secondary"
          >
            <Text variant="default" color="muted" monospace>
              {tool.name}
            </Text>
            <Box flexDirection="column" rowGap="s">
              <Text variant="heading-xxs" as="h3">
                {tool.title}
              </Text>
              <Text variant="body" color="muted" wrap="pretty">
                {tool.desc}
              </Text>
            </Box>
          </Box>
        ))}
      </Grid>
      <ConnectPanel />
    </Box>
  </Chapter>
)
