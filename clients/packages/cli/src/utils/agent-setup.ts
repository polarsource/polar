import type {
  AgentSetupError,
  AgentSetupResult,
  ClientStatus,
  SetupStep,
  SkillScope,
} from '@/schemas/AgentSetup'
import * as ui from '@/utils/ui'

const MCP_DOCS = 'https://polar.sh/docs/integrate/mcp'

export const skillsName = (scope: SkillScope) => `Polar skills (${scope})`

export const errorDetail = (error: AgentSetupError) =>
  ui.step(`  ${[error.message, error.hint].filter(Boolean).join(': ')}`)

export const describeClient = (status: ClientStatus) => {
  if (status.problem) return status.problem
  if (status.installed) return 'Already set up'
  return status.client === 'cursor'
    ? 'Adds the Polar MCP servers and skills'
    : 'Installs the Polar plugin: MCP servers and skills'
}

const clientState = (status: ClientStatus) => {
  if (!status.detected) return ui.dim('not found')
  if (status.problem) return ui.yellow(status.problem)
  if (!status.installed) return 'not set up'
  return `${ui.green('set up')}${status.version ? ` ${ui.dim(status.version)}` : ''}`
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
  const pending = result.clients.some(
    (status) => status.detected && !status.installed && !status.problem,
  )
  const outdated = result.skills.some((skills) => skills.state === 'outdated')
  return [
    ui.blank,
    ui.keyValue(rows),
    ui.blank,
    ...(pending || outdated
      ? [
          ui.step(`Run ${ui.command('polar agent setup')} to set them up`),
          ui.blank,
        ]
      : []),
  ]
}

const count = (
  steps: ReadonlyArray<SetupStep>,
  outcome: SetupStep['outcome'],
) => steps.filter((step) => step.outcome === outcome).length

export const summary = (result: AgentSetupResult) => {
  const { steps } = result
  if (steps.length > 0) {
    const changed = count(steps, 'installed') + count(steps, 'updated')
    return [
      ui.blank,
      `${ui.INDENT}${[
        `${changed} set up`,
        `${count(steps, 'unchanged')} already set up`,
        `${count(steps, 'failed')} failed`,
      ].join(', ')}`,
    ]
  }
  if (result.clients.some((status) => status.detected)) {
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

const signIn: Record<SetupStep['target'], string | undefined> = {
  'claude-code': `Claude Code: restart it, run ${ui.command('/mcp')} and sign in to polar or polar-sandbox`,
  codex: `Codex: run ${ui.command('codex mcp login polar')} or ${ui.command('codex mcp login polar-sandbox')}`,
  cursor: 'Cursor: open Settings → MCP and connect polar or polar-sandbox',
  skills: undefined,
}

export const nextSteps = (result: AgentSetupResult) => {
  const lines = result.steps
    .filter(
      (step) => step.outcome === 'installed' || step.outcome === 'updated',
    )
    .flatMap((step) => signIn[step.target] ?? [])
  return lines.length > 0
    ? [
        ui.blank,
        `${ui.INDENT}${ui.bold('Next, sign in to Polar')}`,
        ...lines.map((line) => ui.step(line)),
        ui.blank,
      ]
    : [ui.blank]
}
