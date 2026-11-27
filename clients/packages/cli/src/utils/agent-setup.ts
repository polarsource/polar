import type {
  AgentSetupError,
  AgentSetupResult,
  ClientStatus,
  SetupStep,
  SkillScope,
  SkillsStatus,
} from '@/schemas/AgentSetup'
import * as ui from '@/utils/ui'

const MCP_DOCS = 'https://polar.sh/docs/integrate/mcp'

export const skillsName = (scope: SkillScope) => `Polar skills (${scope})`

export const errorDetail = (error: AgentSetupError) =>
  ui.step(`  ${[error.message, error.hint].filter(Boolean).join(': ')}`)

export const skillsFound = (skills: ReadonlyArray<SkillsStatus>) =>
  skills.length === 0
    ? 'none installed in .agents/skills or ~/.agents/skills'
    : skills
        .map(
          ({ scope, state }) =>
            `${scope} ${state === 'current' ? 'up to date' : 'out of date'}`,
        )
        .join(', ')

export const versionChange = (before?: string, after?: string) =>
  before && after && before !== after
    ? `updated from ${before} to ${after}`
    : undefined

export const describeClient = (status: ClientStatus) => {
  if (status.problem) return status.problem
  if (status.update) {
    return `Updates the Polar plugin from ${status.version} to ${status.update}`
  }
  if (status.installed) return 'Already set up'
  return status.client === 'cursor'
    ? 'Adds the Polar MCP servers and skills'
    : 'Installs the Polar plugin: MCP servers and skills'
}

const clientState = (status: ClientStatus) => {
  if (!status.detected) return ui.dim('not found')
  if (status.problem) return ui.yellow(status.problem)
  if (!status.installed) return 'not set up'
  const version = status.version
    ? ` ${ui.dim(`· plugin ${status.version}`)}`
    : ''
  const update = status.update
    ? ` ${ui.yellow(`· ${status.update} available`)}`
    : ''
  return `${ui.green('set up')}${version}${update}`
}

export const statusReport = (result: AgentSetupResult) => {
  const rows = [
    ...result.clients.map(
      (status) => [status.name, clientState(status)] as const,
    ),
    ...result.skills.map(
      (skills) =>
        [
          skillsName(skills.scope),
          `${skills.state === 'current' ? ui.green('up to date') : ui.yellow('out of date')} ${ui.dim(skills.directory)}`,
        ] as const,
    ),
  ]
  const pending =
    result.clients.some(
      (status) =>
        status.detected &&
        !status.problem &&
        (!status.installed || status.update !== undefined),
    ) || result.skills.some((skills) => skills.state === 'outdated')
  return [
    ui.blank,
    ui.keyValue(rows),
    ui.blank,
    ...(pending
      ? [
          ui.step(
            `Run ${ui.command('polar agent setup')} to set up or update them`,
          ),
          ui.blank,
        ]
      : []),
  ]
}

const count = (
  steps: ReadonlyArray<SetupStep>,
  ...outcomes: SetupStep['outcome'][]
) => steps.filter((step) => outcomes.includes(step.outcome)).length

export const summary = ({ steps, clients }: AgentSetupResult) => {
  if (steps.length > 0) {
    return [
      ui.blank,
      `${ui.INDENT}${count(steps, 'installed', 'updated')} set up, ${count(steps, 'unchanged')} already set up, ${count(steps, 'failed')} failed`,
    ]
  }
  if (clients.some((status) => status.detected)) {
    return [ui.step('Nothing selected, no changes made'), ui.blank]
  }
  return [
    ui.warning('No Claude Code, Codex or Cursor installation found'),
    ui.step(
      `Install the Polar skills for another agent with ${ui.command('polar agent setup --skills project')}`,
    ),
    ui.step(`and connect it to the Polar MCP server: ${MCP_DOCS}`),
    ui.blank,
  ]
}

const connect: Partial<Record<SetupStep['target'], string>> = {
  'claude-code': `Claude Code: run ${ui.command('/mcp')} and sign in to polar or polar-sandbox`,
  codex: `Codex: run ${ui.command('codex mcp login polar')} or ${ui.command('codex mcp login polar-sandbox')}`,
  cursor: 'Cursor: open Settings → MCP and connect polar or polar-sandbox',
}

export const nextSteps = ({ steps }: AgentSetupResult) => {
  const changed = steps.filter(
    (step) => step.outcome === 'installed' || step.outcome === 'updated',
  )
  if (changed.length === 0) return [ui.blank]
  const servers = changed
    .filter((step) => step.outcome === 'installed')
    .flatMap((step) => connect[step.target] ?? [])
  return [
    ui.blank,
    ui.heading('Next'),
    `${ui.INDENT}Restart your agent, then ask it for what you need from Polar`,
    ui.step(
      `For example ${ui.command('"set up Polar in this project"')} or ${ui.command('"what is my MRR this month?"')}`,
    ),
    ...(servers.length > 0
      ? [
          ui.blank,
          ui.step('To sign in to the Polar MCP server'),
          ...servers.map((line) => ui.step(line)),
        ]
      : []),
    ui.blank,
  ]
}
