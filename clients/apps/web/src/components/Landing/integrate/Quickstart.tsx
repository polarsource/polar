import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowRight } from '@polar-sh/orbit/icons'
import { withOffsets } from '@/utils/lines'
import { Chapter } from '../Chapter'
import { WindowFrame } from '../story/Frame'
import { FrameSheet, ImageBand } from './Backdrop'
import { DocsLink } from './DocsLink'

const AGENT_DOCS = '/docs/integrate/mcp'

/** From nothing to billing in three commands: the CLI, the agent skills, and one prompt. */
const LINES = [
  '# Install Polar CLI',
  'curl -fsSL https://polar.sh/install.sh | bash',
  '',
  '# Install Agentic Polar Skills',
  'polar agent setup',
  '',
  '# Implement Polar for Billing',
  'claude "Sign up for Polar following https://polar.sh/auth.md and then, add Polar billing to this project: create products, add a checkout flow, handle webhooks, and gate paid features by subscription."',
]

/** Shell set in one ink at three weights: commands brightest, their arguments a step back, comments furthest. */
const COMMAND = 'text-black dark:text-white'
const ARGUMENT = 'text-gray-600 dark:text-polar-300'
const COMMENT = 'text-gray-400 dark:text-polar-500'

/**
 * Highlights one line of the snippet: a comment whole, otherwise each piped
 * command's name, then everything it is given.
 */
const Shell = ({ line }: { line: string }) => {
  if (line.startsWith('#')) {
    return <span className={COMMENT}>{line}</span>
  }
  return (
    <>
      {line.split(' | ').map((part, k) => {
        const space = part.indexOf(' ')
        const name = space === -1 ? part : part.slice(0, space)
        const rest = space === -1 ? '' : part.slice(space)
        return (
          <span key={k}>
            {k > 0 ? <span className={COMMENT}>{' | '}</span> : null}
            <span className={COMMAND}>{name}</span>
            <span className={ARGUMENT}>{rest}</span>
          </span>
        )
      })}
    </>
  )
}

interface Step {
  surface: string
  href: string
  title: string
  desc: string
}

/** What each command brings in, and the chapter that goes deeper on it. */
const STEPS: Step[] = [
  {
    surface: 'CLI',
    href: '#cli',
    title: 'Install the CLI',
    desc: 'One binary for signing in, forwarding webhooks to localhost and calling the whole API.',
  },
  {
    surface: 'MCP',
    href: '#mcp',
    title: 'Give your agent Polar',
    desc: 'Finds Claude Code, Codex or Cursor and installs the Polar MCP servers and skills into each.',
  },
  {
    surface: 'SDK',
    href: '#sdk',
    title: 'Ask for billing',
    desc: 'Your agent signs you up, creates the products, and wires checkout, webhooks and access with the SDK.',
  },
]

/**
 * The three commands in a terminal, and a card per command for the surface it brings in. `base` prefixes the card
 * links, so the landing page can send them to the matching chapter on /integrate.
 */
export const QuickstartFigure = ({ base = '' }: { base?: string }) => (
  <Box flexDirection="column" rowGap={{ base: '3xl', md: '4xl' }}>
    <ImageBand
      src="/assets/landing/company/Polar_Flow_01_No_Logo.jpg"
      className="min-h-[20rem] md:min-h-[28rem]"
    >
      <WindowFrame aside="zsh" className="max-w-[48rem]">
        <FrameSheet>
          <ol className="flex flex-col font-mono text-[13px] leading-6">
            {withOffsets(LINES).map(({ line, offset }, k) => (
              <li key={offset} className="flex gap-4">
                <span className="text-polar-600 w-4 shrink-0 text-right tabular-nums select-none">
                  {k + 1}
                </span>
                <span className="min-w-0 flex-1 wrap-break-word whitespace-pre-wrap">
                  {line ? <Shell line={line} /> : <br />}
                </span>
              </li>
            ))}
          </ol>
        </FrameSheet>
      </WindowFrame>
    </ImageBand>
    <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap="l">
      {STEPS.map((step, k) => (
        <a
          key={step.surface}
          href={`${base}${step.href}`}
          className="group flex"
        >
          <Box
            width="100%"
            flexDirection="column"
            justifyContent="between"
            rowGap="xl"
            padding="xl"
            borderRadius="m"
            backgroundColor="background-secondary"
          >
            <Box alignItems="center" justifyContent="between">
              <Text variant="default" color="muted" monospace>
                {`${k + 1}  ${step.surface}`}
              </Text>
              <Box
                color={{ base: 'text-secondary', hover: 'text-primary' }}
                transitionProperty="colors"
                transitionDuration="fast"
              >
                <ArrowRight size={16} />
              </Box>
            </Box>
            <Box flexDirection="column" rowGap="s">
              <Text variant="heading-xxs" as="h3">
                {step.title}
              </Text>
              <Text variant="body" color="muted" wrap="pretty">
                {step.desc}
              </Text>
            </Box>
          </Box>
        </a>
      ))}
    </Grid>
  </Box>
)

export const Quickstart = () => (
  <Chapter
    id="get-started"
    name="01 Get Started"
    title="Three commands to billing"
    subtitle="The CLI, MCP and SDK, in one workflow"
    description="Install the CLI, let it set up your coding agent, then describe what you want billed. The agent does the rest with the same tools covered below."
    cta={<DocsLink href={AGENT_DOCS} label="Agent documentation" />}
  >
    <QuickstartFigure />
  </Chapter>
)
