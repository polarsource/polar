import type {
  AgentSetupError,
  AgentSetupResult,
  ClientStatus,
  SkillScope,
  SkillsStatus,
} from '@/schemas/AgentSetup'
import * as ui from '@/utils/ui'

const MCP_DOCS = 'https://polar.sh/docs/integrate/mcp'

export const skillsName = (scope: SkillScope) => `Polar skills (${scope})`

export const skillsPath = (scope: SkillScope) =>
  `${scope === 'global' ? '~/' : ''}.agents/skills`

export const errorDetail = (error: AgentSetupError) =>
  [error.message, error.hint].filter(Boolean).join(': ')

export const skillsFound = (skills: ReadonlyArray<SkillsStatus>) =>
  skills.length === 0
    ? ui.dim('none installed in .agents/skills or ~/.agents/skills')
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

export const clientState = (status: ClientStatus) => {
  if (!status.detected) return ui.dim('not found')
  if (status.problem) return ui.yellow(status.problem)
  if (!status.installed) return ui.dim('not set up')
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
    ui.heading('Status'),
    ui.box(ui.keyValue(rows)),
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

export const summary = ({ steps, clients }: AgentSetupResult) => {
  if (steps.length > 0) return []
  if (clients.some((status) => status.detected)) {
    return [ui.blank, ui.step('Nothing selected, no changes made'), ui.blank]
  }
  return [
    ui.blank,
    ui.warning('No Claude Code, Codex or Cursor installation found'),
    ui.step(
      `Install the Polar skills for another agent with ${ui.command('polar agent setup --skills project')}`,
    ),
    ui.step(`and connect it to the Polar MCP server: ${MCP_DOCS}`),
    ui.blank,
  ]
}

type NextStep = readonly [title: string, details: ReadonlyArray<string>]

const DETAIL = `${ui.INDENT}   `

const listed = (items: ReadonlyArray<NextStep>) =>
  items.flatMap(([title, details], index) => [
    ...(index > 0 ? [ui.blank] : []),
    `${ui.INDENT}${items.length > 1 ? `${index + 1}. ` : ''}${title}`,
    ...details.map(
      (detail) => `${items.length > 1 ? DETAIL : ui.INDENT}${detail}`,
    ),
  ])

export const nextSteps = ({ steps }: AgentSetupResult) => {
  const ready = steps.filter((step) => step.outcome !== 'failed')
  if (ready.length === 0) return [ui.blank]
  const changed = ready.some((step) => step.outcome !== 'unchanged')
  const restart: ReadonlyArray<NextStep> = changed
    ? [['Restart your agent so it loads Polar', []]]
    : []
  const lines = listed([
    ...restart,
    [
      `Ask ${changed ? 'it' : 'your agent'} to get you started`,
      [`${ui.dim('›')} ${ui.command('"Help me get started with Polar"')}`],
    ],
  ])
  return [ui.blank, ui.heading('Next'), ui.box(lines.join('\n')), ui.blank]
}
