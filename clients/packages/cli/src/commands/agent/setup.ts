import { Effect, Option, Stdio } from 'effect'
import { Command, Flag, Prompt } from 'effect/cli'
import {
  AgentSetupError,
  AgentSetupResult,
  type Client,
  type ClientStatus,
  type SetupStep,
  type SkillScope,
  type SkillsStatus,
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
  readonly scope: SkillScope | undefined
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
  Effect.gen(function* () {
    const picked = yield* Prompt.run(
      Prompt.MultiSelect<Client | 'skills'>({
        message: 'What should be set up for Polar?',
        choices: [
          ...detected.map((status) => ({
            title: status.name,
            value: status.client,
            description: describeClient(status),
            selected: !status.installed && status.problem === undefined,
          })),
          {
            title: 'Polar skills',
            value: 'skills',
            description: 'For other agents, in .agents/skills',
            selected: scope !== undefined || detected.length === 0,
          },
        ],
      }),
    ).pipe(Effect.orElseSucceed((): ReadonlyArray<Client | 'skills'> => []))
    const targets = detected.filter((status) => picked.includes(status.client))
    if (!picked.includes('skills')) return { targets, scope: undefined }
    if (scope) return { targets, scope }
    const chosen = yield* Prompt.run(
      Prompt.Select<SkillScope | undefined>({
        message: 'Where should the Polar skills go?',
        choices: [
          {
            title: 'This project',
            value: 'project',
            description: '.agents/skills',
          },
          {
            title: 'Your home directory',
            value: 'global',
            description: '~/.agents/skills',
          },
        ],
      }),
    ).pipe(Effect.orElseSucceed(() => undefined))
    return chosen ? { targets, scope: chosen } : { targets: [], scope }
  })

const select = (
  detected: ReadonlyArray<ClientStatus>,
  only: Client | undefined,
  scope: SkillScope | undefined,
  yes: boolean,
) =>
  Effect.gen(function* () {
    const setup = yield* AgentSetup
    const { json } = yield* Output
    const agent = setup.callingAgent
    if (agent && !only) {
      const own = detected.find((status) => status.client === agent)
      if (own) {
        yield* note(ui.step(`Running inside ${own.name}, setting up only it`))
        return { targets: [own], scope }
      }
      if (!isClient(agent)) {
        yield* note(
          ui.step(
            `Running inside ${agent}, which has no Polar plugin, installing the Polar skills instead`,
          ),
        )
        return { targets: [], scope: scope ?? 'project' }
      }
    }
    if (yes || json || agent || only || !(yield* interactive)) {
      return { targets: detected, scope }
    }
    yield* note(ui.blank)
    return yield* pick(detected, scope)
  })

const setUpClient = (target: ClientStatus, force: boolean) =>
  Effect.gen(function* () {
    const step = (
      outcome: SetupStep['outcome'],
      detail?: string,
    ): SetupStep => ({
      target: target.client,
      name: target.name,
      outcome,
      ...(detail ? { detail } : {}),
    })
    if (target.problem) {
      yield* note(ui.failure(target.name, target.problem))
      return step('failed', target.problem)
    }
    if (target.installed && !force) {
      yield* note(ui.success(`${target.name} ${ui.dim('already set up')}`))
      return step('unchanged')
    }
    const setup = yield* AgentSetup
    return yield* withProgress((progress) =>
      progress.start(target.name).pipe(Effect.andThen(setup.setUp(target))),
    ).pipe(
      Effect.as(step(target.installed ? 'updated' : 'installed')),
      Effect.catch((error) =>
        note(errorDetail(error)).pipe(Effect.as(step('failed', error.message))),
      ),
    )
  })

const setUpSkills = (scope: SkillScope, force: boolean) =>
  Effect.gen(function* () {
    const setup = yield* AgentSetup
    const name = skillsName(scope)
    const step = (
      outcome: SetupStep['outcome'],
      detail?: string,
    ): SetupStep => ({
      target: 'skills',
      name,
      outcome,
      ...(detail ? { detail } : {}),
    })
    return yield* withProgress((progress) =>
      Effect.gen(function* () {
        yield* progress.start(name)
        const before = yield* setup.skills(scope)
        if (before.state === 'current' && !force) {
          yield* progress.finish('already up to date')
          return step('unchanged', before.directory)
        }
        const after = yield* setup.installSkills(scope)
        yield* progress.finish(after.directory)
        return step(
          before.state === 'missing' ? 'installed' : 'updated',
          after.directory,
        )
      }),
    ).pipe(
      Effect.catch((error) =>
        note(errorDetail(error)).pipe(Effect.as(step('failed', error.message))),
      ),
    )
  })

const installedSkills = Effect.gen(function* () {
  const setup = yield* AgentSetup
  const found = yield* Effect.forEach(skillScopes, (scope) =>
    setup.skills(scope).pipe(Effect.option),
  )
  return found
    .flatMap((status) => Option.toArray(status))
    .filter((status): status is SkillsStatus => status.state !== 'missing')
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

    const selection: Selection = yield* select(
      detected,
      only,
      Option.getOrUndefined(input.skills),
      input.yes,
    )
    const steps: SetupStep[] = []
    for (const target of selection.targets) {
      steps.push(yield* setUpClient(target, input.force))
    }
    if (selection.scope) {
      steps.push(yield* setUpSkills(selection.scope, input.force))
    }
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
