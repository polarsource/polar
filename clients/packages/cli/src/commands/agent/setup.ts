import { Effect, Fiber, Option } from 'effect'
import { Command, Flag } from 'effect/cli'
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
import { confirm } from '@/utils/flags'
import {
  clientState,
  describeClient,
  errorDetail,
  nextSteps,
  skillsFound,
  skillsName,
  skillsPath,
  statusReport,
  summary,
  versionChange,
} from '@/utils/agent-setup'
import { Output } from '@/utils/output'
import { type Progress, note, withProgress } from '@/utils/progress'
import { typeBanner } from '@/utils/logo'
import { interactive, multiSelect } from '@/utils/prompt'
import * as ui from '@/utils/ui'

const status = Flag.Boolean('status').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Show what is set up without changing anything'),
)
const confirmAll = confirm.pipe(
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

const skillsDescription = (scope: SkillScope, outdated: boolean) => {
  const directory = skillsPath(scope)
  return outdated
    ? `Out of date, updates ${directory}`
    : `For other agents, in ${directory}`
}

const pick = (
  detected: ReadonlyArray<ClientStatus>,
  scope: SkillScope | undefined,
  skills: ReadonlyArray<SkillsStatus>,
) =>
  multiSelect<Client | SkillScope>({
    message: 'What should be set up for Polar?',
    choices: [
      ...detected.map((status) => ({
        title: status.name,
        value: status.client,
        description: describeClient(status),
        selected:
          status.problem === undefined &&
          (!status.installed || status.update !== undefined),
      })),
      ...skillScopes.map((value) => {
        const outdated = skills.some(
          (status) => status.scope === value && status.state === 'outdated',
        )
        return {
          title: skillsName(value),
          value,
          description: skillsDescription(value, outdated),
          selected:
            scope === value ||
            outdated ||
            (scope === undefined &&
              value === 'project' &&
              detected.length === 0),
        }
      }),
    ],
  }).pipe(
    Effect.orElseSucceed((): ReadonlyArray<Client | SkillScope> => []),
    Effect.map(
      (picked): Selection => ({
        targets: detected.filter((status) => picked.includes(status.client)),
        scopes: skillScopes.filter((scope) => picked.includes(scope)),
      }),
    ),
  )

const padded = (names: ReadonlyArray<string>) => {
  const width = Math.max(...names.map((name) => name.length)) + 1
  return (name: string) => name.padEnd(width)
}

const done = (detail: string) => `${ui.green('✔')} ${detail}`

const SKILLS = 'Skills'

const checkSkills = (progress: Progress, label: string) =>
  progress.start(label).pipe(
    Effect.andThen(findSkills),
    Effect.tap((found) => progress.finish(skillsFound(found))),
    Effect.catch((error) =>
      progress
        .fail(error.message)
        .pipe(Effect.as<ReadonlyArray<SkillsStatus>>([])),
    ),
  )

const select = (
  progress: Progress,
  skillsLabel: string,
  detected: ReadonlyArray<ClientStatus>,
  only: Client | undefined,
  scope: SkillScope | undefined,
  confirm: boolean,
) =>
  Effect.gen(function* () {
    const { callingAgent: agent } = yield* AgentSetup
    const { json } = yield* Output
    const scopes: ReadonlyArray<SkillScope> = scope ? [scope] : []
    if (agent && !only) {
      const own = detected.find((status) => status.client === agent.id)
      if (own) {
        yield* progress.close
        yield* note(ui.step(`Running inside ${own.name}, setting up only it`))
        return { targets: [own], scopes }
      }
      if (isClient(agent.id)) {
        return yield* new AgentSetupError({
          message: `Running inside ${agent.name}, but ${agent.name} was not found on this machine`,
          hint: 'Pass --client to set up another agent.',
        })
      }
      yield* progress.close
      yield* note(
        ui.step(
          `Running inside ${agent.name}, which has no Polar plugin, installing the Polar skills instead`,
        ),
      )
      return { targets: [], scopes: [scope ?? 'project'] }
    }
    if (confirm || only || !(yield* interactive)) {
      return { targets: detected, scopes }
    }
    if (json) {
      return yield* new AgentSetupError({
        message: 'Choose what to set up',
        hint: 'Pass --confirm to set up every detected agent, or --client to pick one.',
      })
    }
    const skills = yield* checkSkills(progress, skillsLabel)
    yield* progress.close
    return yield* pick(detected, scope, skills)
  })

const step = (
  target: SetupStep['target'],
  name: string,
  outcome: SetupStep['outcome'],
  detail?: string,
): SetupStep => ({ target, name, outcome, ...(detail ? { detail } : {}) })

const attempt = <R>(
  progress: Progress,
  target: SetupStep['target'],
  name: string,
  work: Effect.Effect<SetupStep, AgentSetupError, R>,
) =>
  work.pipe(
    Effect.catch((error) =>
      progress
        .fail(`${ui.red('✖')} ${errorDetail(error)}`)
        .pipe(Effect.as(step(target, name, 'failed', error.message))),
    ),
  )

const setUpClient = (
  progress: Progress,
  label: string,
  target: ClientStatus,
  force: boolean,
) =>
  attempt(
    progress,
    target.client,
    target.name,
    Effect.gen(function* () {
      yield* progress.start(label)
      if (target.installed && !target.update && !force) {
        yield* progress.finish(done(ui.dim('already set up')))
        return step(target.client, target.name, 'unchanged')
      }
      if (target.problem) {
        return yield* new AgentSetupError({ message: target.problem })
      }
      const version = yield* (yield* AgentSetup).setUp(target)
      const change = versionChange(target.version, version)
      yield* progress.finish(
        done(change ?? (target.installed ? 'updated' : 'set up')),
      )
      return step(
        target.client,
        target.name,
        target.installed ? 'updated' : 'installed',
        change,
      )
    }),
  )

const setUpSkills = (
  progress: Progress,
  label: string,
  scope: SkillScope,
  force: boolean,
) => {
  const name = skillsName(scope)
  return attempt(
    progress,
    'skills',
    name,
    Effect.gen(function* () {
      const setup = yield* AgentSetup
      yield* progress.start(label)
      const before = yield* setup.skills(scope)
      if (before.state === 'current' && !force) {
        yield* progress.finish(done(ui.dim('already up to date')))
        return step('skills', name, 'unchanged', before.directory)
      }
      const after = yield* setup.installSkills(scope)
      yield* progress.finish(done(skillsPath(scope)))
      return step(
        'skills',
        name,
        before.state === 'missing' ? 'installed' : 'updated',
        after.directory,
      )
    }),
  )
}

const findSkills = Effect.gen(function* () {
  const setup = yield* AgentSetup
  const found = yield* Effect.forEach(skillScopes, setup.skills)
  return found.filter((status) => status.state !== 'missing')
})

const installedSkills = findSkills.pipe(
  Effect.catch((error) =>
    note(ui.warning(`Could not check the Polar skills: ${error.message}`)).pipe(
      Effect.as([]),
    ),
  ),
)

interface Input {
  readonly status: boolean
  readonly confirm: boolean
  readonly force: boolean
  readonly client: Option.Option<Client>
  readonly skills: Option.Option<SkillScope>
}

const execute = (progress: Progress, input: Input) =>
  Effect.gen(function* () {
    const setup = yield* AgentSetup
    const only = Option.getOrUndefined(input.client)
    if (input.status) {
      yield* progress.start('Detecting coding agents')
      const statuses = yield* setup.detect(only ? [only] : clients)
      yield* progress.clear
      return { clients: statuses, skills: yield* installedSkills, steps: [] }
    }
    const { callingAgent } = setup
    const { json } = yield* Output
    const detecting = yield* Effect.forkChild(
      setup.detect(only ? [only] : clients),
    )
    if (!callingAgent && !json && (yield* interactive)) {
      yield* typeBanner([
        ['Polar agent setup', ui.bold],
        ['Connect your coding agents to Polar', ui.dim],
      ])
    }
    yield* progress.open('Detected')
    yield* progress.start('Agents')
    const statuses = yield* Fiber.join(detecting)
    const detected = statuses.filter((status) => status.detected)
    const label = padded([SKILLS, ...detected.map((status) => status.name)])
    if (detected.length === 0) {
      yield* progress.finish('none found')
    } else {
      yield* progress.clear
      yield* Effect.forEach(detected, (status) =>
        progress
          .start(label(status.name))
          .pipe(Effect.andThen(progress.finish(clientState(status)))),
      )
    }
    if (only && detected.length === 0) {
      const name = statuses[0]?.name ?? only
      return yield* new AgentSetupError({
        message: `${name} was not found on this machine`,
        hint: `Install ${name}, or make sure it is on your PATH.`,
      })
    }
    const selection = yield* select(
      progress,
      label(SKILLS),
      detected,
      only,
      Option.getOrUndefined(input.skills),
      input.confirm,
    )
    const names = [
      ...selection.targets.map((target) => target.name),
      ...selection.scopes.map(skillsName),
    ]
    if (names.length === 0) return { clients: statuses, skills: [], steps: [] }
    const row = padded(names)
    yield* progress.open('Setup')
    const steps = [
      ...(yield* Effect.forEach(selection.targets, (target) =>
        setUpClient(progress, row(target.name), target, input.force),
      )),
      ...(yield* Effect.forEach(selection.scopes, (scope) =>
        setUpSkills(progress, row(skillsName(scope)), scope, input.force),
      )),
    ]
    return { clients: statuses, skills: [], steps }
  })

const runSetup = (input: Input) =>
  withProgress(
    (progress) => execute(progress, input),
    input.status ? 'checks' : 'columns',
  )

export const setup = Command.make('setup', {
  status,
  confirm: confirmAll,
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
      command: 'polar agent setup --confirm --json',
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
