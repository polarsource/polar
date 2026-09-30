import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Chapter } from '../Chapter'
import { DocsLink } from './DocsLink'
import { AgentSession } from './AgentSession'
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

export const Mcp = () => (
  <Chapter
    id="mcp"
    index="01"
    name="MCP"
    title="Agents included"
    subtitle="Polar as a tool your agent can call"
    description="A remote MCP server with OAuth, so there are no keys to paste. Three meta-tools keep the context small, so the agent only loads the operations it needs."
    cta={<DocsLink href={MCP_DOCS} label="MCP documentation" />}
  >
    <Box flexDirection="column" rowGap={{ base: '3xl', md: '4xl' }}>
      <ConnectPanel />
      <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap="l">
        <Box
          alignItems="center"
          justifyContent="center"
          paddingHorizontal={{ base: 'l', md: '3xl' }}
          paddingVertical={{ base: '2xl', md: '3xl' }}
          minHeight={{ base: '20rem', md: '24rem' }}
          backgroundColor="background-secondary"
        >
          <AgentSession />
        </Box>
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
          {TOOLSET.map((tool) => (
            <Box
              key={tool.name}
              flexDirection="column"
              rowGap="xl"
              padding="xl"
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
      </Grid>
    </Box>
  </Chapter>
)
