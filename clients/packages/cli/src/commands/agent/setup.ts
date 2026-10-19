import { Array, Effect, Option, Stdio } from 'effect'
import { Command, Flag, Prompt } from 'effect/cli'
import {
  AgentSetupError,
  AgentSetupResult,
  type Client,
  type ClientStatus,
  type SetupStep,
  type SkillScope,
  clients,
  skillScopes,
} from '@/schemas/AgentSetup'
import { AgentSetup } from '@/services/agent-setup/service'
import { output } from '@/utils/command'
import {
  describeClient,
  errorDetail,
  nextSteps,
  skillsName,
  statusReport,
  summary,
} from '@/utils/agent-setup'
import { Output } from '@/utils/output'
import { note, withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const status = Flag.Boolean('status').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Show what is set up without changing anything'),
)
const yes = Flag.Boolean('yes').pipe(
  Flag.withAlias('y'),
  Flag.withDefault(false),
  Flag.withDescription('Set up every detected agent without asking'),
)
const force = Flag.Boolean('force').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Reinstall even when an agent is already set up'),
)
const client = Flag.Literals('client', clients).pipe(
  Flag.optional,
  Flag.withDescription('Only set up this agent'),
)
const skills = Flag.Literals('skills', skillScopes).pipe(
  Flag.optional,
  Flag.withDescription(
    'Also install the Polar skills into .agents/skills of this directory (project) or your home directory (global), for agents without a Polar plugin',
  ),
)

interface Selection {
  readonly targets: ReadonlyArray<ClientStatus>
  readonly scopes: ReadonlyArray<SkillScope>
}

const isClient = (agent: string): agent is Client =>
  clients.some((client) => client === agent)

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const pick = (
  detected: ReadonlyArray<ClientStatus>,
  scope: SkillScope | undefined,
) =>
  Prompt.run(
    Prompt.MultiSelect<Client | SkillScope>({
      message: 'What should be set up for Polar?',
      choices: [
        ...detected.map((status) => ({
          title: status.name,
          value: status.client,
          description: describeClient(status),
          selected: !status.installed && status.problem === undefined,
        })),
        ...skillScopes.map((value) => ({
          title: skillsName(value),
          value,
          description: `For other agents, in ${value === 'global' ? '~/' : ''}.agents/skills`,
          selected:
            scope === value ||
            (scope === undefined &&
              value === 'project' &&
              detected.length === 0),
        })),
      ],
    }),
  ).pipe(
    Effect.orElseSucceed((): ReadonlyArray<Client | SkillScope> => []),
    Effect.map(
      (picked): Selection => ({
        targets: detected.filter((status) => picked.includes(status.client)),
        scopes: skillScopes.filter((scope) => picked.includes(scope)),
      }),
    ),
  )

const select = (
  detected: ReadonlyArray<ClientStatus>,
  only: Client | undefined,
  scope: SkillScope | undefined,
  yes: boolean,
) =>
  Effect.gen(function* () {
    const { callingAgent: agent } = yield* AgentSetup
    const { json } = yield* Output
    const scopes: ReadonlyArray<SkillScope> = scope ? [scope] : []
    if (agent && !only) {
      const own = detected.find((status) => status.client === agent)
      if (own) {
        yield* note(ui.step(`Running inside ${own.name}, setting up only it`))
        return { targets: [own], scopes }
      }
      if (!isClient(agent)) {
        yield* note(
          ui.step(
            `Running inside ${agent}, which has no Polar plugin, installing the Polar skills instead`,
          ),
        )
        return { targets: [], scopes: [scope ?? 'project'] }
      }
    }
    if (yes || json || agent || only || !(yield* interactive)) {
      return { targets: detected, scopes }
    }
    yield* note(ui.blank)
    return yield* pick(detected, scope)
  })

const step = (
  target: SetupStep['target'],
  name: string,
  outcome: SetupStep['outcome'],
  detail?: string,
): SetupStep => ({ target, name, outcome, ...(detail ? { detail } : {}) })

const attempt = <R>(
  target: SetupStep['target'],
  name: string,
  work: Effect.Effect<SetupStep, AgentSetupError, R>,
) =>
  work.pipe(
    Effect.catch((error) =>
      note(errorDetail(error)).pipe(
        Effect.as(step(target, name, 'failed', error.message)),
      ),
    ),
  )

const setUpClient = (target: ClientStatus, force: boolean) =>
  attempt(
    target.client,
    target.name,
    Effect.gen(function* () {
      if (target.installed && !force) {
        yield* note(ui.success(`${target.name} ${ui.dim('already set up')}`))
        return step(target.client, target.name, 'unchanged')
      }
      const setup = yield* AgentSetup
      yield* withProgress((progress) =>
        progress
          .start(target.name)
          .pipe(
            Effect.andThen(
              target.problem
                ? Effect.fail(new AgentSetupError({ message: target.problem }))
                : setup.setUp(target),
            ),
          ),
      )
      return step(
        target.client,
        target.name,
        target.installed ? 'updated' : 'installed',
      )
    }),
  )

const setUpSkills = (scope: SkillScope, force: boolean) => {
  const name = skillsName(scope)
  return attempt(
    'skills',
    name,
    withProgress((progress) =>
      Effect.gen(function* () {
        const setup = yield* AgentSetup
        yield* progress.start(name)
        const before = yield* setup.skills(scope)
        if (before.state === 'current' && !force) {
          yield* progress.finish('already up to date')
          return step('skills', name, 'unchanged', before.directory)
        }
        const after = yield* setup.installSkills(scope)
        yield* progress.finish(after.directory)
        return step(
          'skills',
          name,
          before.state === 'missing' ? 'installed' : 'updated',
          after.directory,
        )
      }),
    ),
  )
}

const installedSkills = Effect.gen(function* () {
  const setup = yield* AgentSetup
  const found = yield* Effect.forEach(skillScopes, (scope) =>
    setup.skills(scope).pipe(Effect.option),
  )
  return Array.getSomes(found).filter((status) => status.state !== 'missing')
})

interface Input {
  readonly status: boolean
  readonly yes: boolean
  readonly force: boolean
  readonly client: Option.Option<Client>
  readonly skills: Option.Option<SkillScope>
}

const runSetup = (input: Input) =>
  Effect.gen(function* () {
    const setup = yield* AgentSetup
    const only = Option.getOrUndefined(input.client)
    yield* note(ui.blank)
    const statuses = yield* withProgress((progress) =>
      Effect.gen(function* () {
        yield* progress.start('Detecting coding agents')
        const statuses = yield* setup.detect(only ? [only] : clients)
        const found = statuses.filter((status) => status.detected)
        yield* progress.finish(
          found.map((status) => status.name).join(', ') || 'none found',
        )
        return statuses
      }),
    )
    const detected = statuses.filter((status) => status.detected)
    if (input.status) {
      return { clients: statuses, skills: yield* installedSkills, steps: [] }
    }
    if (only && detected.length === 0) {
      const name = statuses[0]?.name ?? only
      return yield* new AgentSetupError({
        message: `${name} was not found on this machine`,
        hint: `Install ${name}, or make sure it is on your PATH.`,
      })
    }
    const selection = yield* select(
      detected,
      only,
      Option.getOrUndefined(input.skills),
      input.yes,
    )
    const steps = [
      ...(yield* Effect.forEach(selection.targets, (target) =>
        setUpClient(target, input.force),
      )),
      ...(yield* Effect.forEach(selection.scopes, (scope) =>
        setUpSkills(scope, input.force),
      )),
    ]
    return { clients: statuses, skills: [], steps }
  })

export const setup = Command.make('setup', {
  status,
  yes,
  force,
  client,
  skills,
}).pipe(
  Command.withDescription(
    'Install the Polar plugin, MCP server and skills for your coding agents',
  ),
  Command.withExamples([
    {
      command: 'polar agent setup',
      description:
        'Detect Claude Code, Codex and Cursor, then choose what to set up',
    },
    {
      command: 'polar agent setup --status',
      description: 'Show what is already set up',
    },
    {
      command: 'polar agent setup --client claude-code',
      description: 'Only install the Polar plugin for Claude Code',
    },
    {
      command: 'polar agent setup --skills project',
      description:
        'Install the Polar skills into .agents/skills for any other agent',
    },
    {
      command: 'polar agent setup --yes --json',
      description: 'Set up every detected agent without asking, for scripts',
    },
  ]),
  output({
    result: AgentSetupResult,
    run: runSetup,
    render: (result, input) =>
      input.status
        ? statusReport(result)
        : [...summary(result), ...nextSteps(result)],
    failed: (result) => {
      const failed = result.steps.filter((step) => step.outcome === 'failed')
      return failed.length > 0
        ? new AgentSetupError({
            message: `Could not set up ${failed.map((step) => step.name).join(', ')}`,
          })
        : undefined
    },
  }),
)
