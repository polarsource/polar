import { Effect, FileSystem, Option, Schema } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import { announceAuthorization } from '@/commands/auth'
import { clients } from '@/schemas/AgentSetup'
import {
  ActiveOrganization,
  AuthError,
  loginCommand,
  PolarEnvironment,
} from '@/schemas/Auth'
import {
  BillingConfigError,
  DEFAULT_CONFIG_FILES,
  ExternalIdAssignment,
  FORMATS,
  InitResult,
} from '@/schemas/BillingConfig'
import { AgentSetup } from '@/services/agent-setup/service'
import { Auth } from '@/services/auth'
import {
  BillingConfig,
  languageFor,
  LANGUAGES,
  languagesAt,
  MANIFESTS,
  output as ranOutput,
  projectRoot,
  type Run,
} from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { SKIP_REASONS } from '@/utils/billing-config/catalog'
import { nameResources, parseExternalIds } from '@/utils/billing-config/name'
import { plural } from '@/utils/billing-config/problems'
import { banner } from '@/utils/logo'
import { confirm, select, interactive } from '@/utils/prompt'
import { section, target } from '@/utils/billing-config/review'
import { output } from '@/utils/command'
import {
  confirm as confirmFlag,
  local,
  org,
  production,
  sandbox,
} from '@/utils/flags'
import { Output } from '@/utils/output'
import { type Progress, withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Where to write the config. Defaults to polar.config.ts at the root of a JavaScript or TypeScript project, polar_config.py at the root of a Python project, polar.config.json otherwise',
  ),
  Argument.optional,
)

const format = Flag.Literals('format', FORMATS).pipe(
  Flag.optional,
  Flag.withDescription(
    'Write TypeScript (ts), Python (py) or JSON (json). Detected from your project when omitted: ts with a package.json, py with a pyproject.toml. In a terminal you confirm it, or choose when both or neither exist. Outside a terminal it writes ts when both exist and json when neither does',
  ),
)

const skipInstall = Flag.Boolean('skip-install').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Do not install the package a TypeScript config imports, @polar-sh/polar',
  ),
)

const acceptSuggestions = confirmFlag.pipe(
  Flag.withDescription(
    'Use the suggested external IDs for meters, benefits and products that have none, without asking',
  ),
)

const externalIds = Flag.atLeast(
  Flag.String('external-id').pipe(
    Flag.withDescription(
      'Give the resource with this ID this external ID, as <id>=<external ID>. Repeat it for each resource. Without a terminal, every resource without an external ID needs one, unless you pass --confirm',
    ),
  ),
  0,
)

const CodingAgents = Schema.Struct({
  names: Schema.Array(Schema.String),
  ready: Schema.Boolean,
})
type CodingAgents = typeof CodingAgents.Type

const Written = Schema.Struct({
  status: Schema.Literal('written'),
  ...InitResult.fields,
  organization: ActiveOrganization,
  org: Schema.optionalKey(Schema.String),
  caller: Schema.optionalKey(Schema.String),
  agents: Schema.optionalKey(CodingAgents),
  next: Schema.Array(Schema.String),
})
type Written = typeof Written.Type

const Required = Schema.Struct({
  status: Schema.Literal('external_ids_required'),
  organization: ActiveOrganization,
  external_ids: Schema.Array(ExternalIdAssignment),
  next: Schema.Array(Schema.String),
})
type Required = typeof Required.Type

const Init = Schema.Union([Written, Required])
type Init = typeof Init.Type

type EnvironmentFlags = Record<PolarEnvironment, boolean>

const chosenEnvironment = (flags: EnvironmentFlags) => {
  const chosen = (Object.keys(flags) as PolarEnvironment[]).filter(
    (environment) => flags[environment],
  )
  if (chosen.length > 1) {
    return Effect.fail(
      new AuthError({ message: 'Pass only one environment flag.' }),
    )
  }
  return Effect.succeed(chosen[0])
}

const pickEnvironment = select<PolarEnvironment>(
  {
    message: 'Which environment do you want to set up?',
    choices: [
      { title: 'Sandbox', value: 'sandbox', description: 'sandbox.polar.sh' },
      { title: 'Production', value: 'production', description: 'polar.sh' },
    ],
  },
  (environment) => environment,
)

const pickOrganization = (environment: PolarEnvironment, prompt: boolean) =>
  Effect.gen(function* () {
    const items = yield* (yield* Organizations).list(environment)
    if (items.length === 1) return items[0]!
    if (items.length === 0) {
      return yield* new AuthError({
        message: `No organizations in ${environment} yet. Create one in the dashboard, then run polar config init again.`,
      })
    }
    if (!prompt) {
      return yield* new AuthError({
        message: `Pass --org <slug> to choose one of ${items.map((item) => item.slug).join(', ')}.`,
      })
    }
    return yield* select(
      {
        message: `Which ${environment} organization do you want to set up?`,
        choices: items.map((item) => ({
          value: item,
          title: item.name,
          description: item.slug,
        })),
      },
      (item) => item.name,
    )
  })

const notLoggedIn = (environment?: PolarEnvironment) =>
  new AuthError({
    message:
      environment === undefined
        ? `Not logged in. Run ${loginCommand('sandbox')} or ${loginCommand('production')} first.`
        : `Not logged in to ${environment}. Run ${loginCommand(environment)} first.`,
  })

const login = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    yield* (yield* Auth).login(
      environment,
      false,
      announceAuthorization(environment),
    )
    return environment
  })

const ensureSession = (environment: PolarEnvironment, prompt: boolean) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    if (yield* auth.override) return
    if ((yield* auth.environments).includes(environment)) return
    if (!prompt) return yield* notLoggedIn(environment)
    yield* login(environment)
  })

const resolveOrganization = (
  flags: EnvironmentFlags,
  reference: string | undefined,
  prompt: boolean,
) =>
  Effect.gen(function* () {
    const organizations = yield* Organizations
    const environment = yield* chosenEnvironment(flags)
    if (environment !== undefined) {
      yield* ensureSession(environment, prompt)
      return reference === undefined
        ? yield* pickOrganization(environment, prompt)
        : yield* organizations.resolve(reference, environment)
    }
    if (reference !== undefined) return yield* organizations.resolve(reference)
    const auth = yield* Auth
    if ((yield* auth.environments).length === 0 && !(yield* auth.override)) {
      if (!prompt) return yield* notLoggedIn()
      return yield* pickOrganization(
        yield* login(yield* pickEnvironment),
        prompt,
      )
    }
    return yield* organizations.resolve()
  })

const projectDirectory = (fs: FileSystem.FileSystem) =>
  Effect.map(projectRoot(fs, process.cwd()), (root) => root ?? process.cwd())

const detectFormat = (
  fs: FileSystem.FileSystem,
  directory: string,
  prompt: boolean,
  progress: Progress,
) =>
  Effect.gen(function* () {
    yield* progress.start('Detecting language')
    const detected = yield* languagesAt(fs, directory)
    const guess = prompt && detected.length > 1 ? undefined : detected[0]
    const found = detected.map(({ manifest }) => `a ${manifest}`).join(' and ')
    yield* progress.finish(
      guess !== undefined
        ? `${guess.title} detected, found ${found}`
        : detected.length === 0
          ? `No ${MANIFESTS.join(' or ')} found`
          : `Found ${found}`,
    )
    if (!prompt) return guess?.format
    if (
      guess !== undefined &&
      (yield* confirm(
        `Write a ${guess.title} config (${guess.defaultFiles[0]})?`,
      ))
    ) {
      return guess.format
    }
    return yield* select(
      {
        message: 'Which format should the config be in?',
        choices: LANGUAGES.map(({ format, title, defaultFiles }) => ({
          value: format,
          title,
          description: defaultFiles[0]!,
        })),
      },
      (format) => languageFor(format).title,
    )
  })

const detectAgents = (setup: (typeof AgentSetup)['Service']) =>
  Effect.gen(function* () {
    const statuses = yield* setup.detect(clients).pipe(
      Effect.timeoutOrElse({
        duration: '3 seconds',
        orElse: () => Effect.succeed([]),
      }),
    )
    const found = statuses.filter((status) => status.detected)
    const ready = found.filter((status) => status.installed)
    if (found.length === 0) return undefined
    return {
      names: (ready.length > 0 ? ready : found).map((status) => status.name),
      ready: ready.length > 0,
    } satisfies CodingAgents
  })

const packageOf = (command: ReadonlyArray<string>) => command.at(-1)!

const confirmInstall = (
  command: ReadonlyArray<string>,
  prompt: boolean,
  skip: boolean,
) =>
  skip
    ? Effect.succeed(false)
    : prompt
      ? confirm(
          `Install ${packageOf(command)} with ${ui.command(command.join(' '))} now?`,
        )
      : Effect.succeed(true)

const configCommand = (
  command: 'plan' | 'apply' | 'publish',
  { file, org }: Pick<Written, 'file' | 'org'>,
) =>
  [
    `polar config ${command}`,
    ...((DEFAULT_CONFIG_FILES as ReadonlyArray<string>).includes(file)
      ? []
      : [file]),
    ...(org === undefined ? [] : [`--org ${org}`]),
  ].join(' ')

const imported = ({ imported }: Pick<Written, 'imported'>) =>
  imported.meters + imported.benefits + imported.products

type Outcome = Omit<Written, 'next' | 'status'>

interface Style {
  readonly command: (text: string) => string
  readonly file: (text: string) => string
}

const PLAIN: Style = { command: (text) => text, file: (text) => text }
const HIGHLIGHTED: Style = { command: ui.command, file: ui.bold }

const agentSteps = (result: Outcome, { command, file }: Style) => [
  `If you don't have the polar-config skill, run ${command('polar agent setup --skills project')} and read ${file('.agents/skills/polar-config/SKILL.md')}. It sets up Polar for this agent and adds the Polar skills to this project, so tell the user before you run it.`,
  ...(imported(result) > 0
    ? [
        `${file(result.file)} matches the catalog on Polar, so the config is set up. If the user asked for no change, run ${command(configCommand('plan', result))} to confirm nothing would change, tell them it is ready and stop.`,
        `Otherwise make their change in ${file(result.file)}. Ask the user for any price you cannot find, never invent one.`,
      ]
    : [
        `Write the meters, benefits and products into ${file(result.file)} from this app's pricing. Ask the user for any price you cannot find, never invent one.`,
      ]),
  `Run ${command(`${configCommand('plan', result)} --json`)} and fix every error it reports in the file.`,
  'Tell the user what would change and wait for their go-ahead.',
  `Run ${command(`${configCommand('apply', result)} --confirm`)}. If it saves a draft, ask before running ${command(`${configCommand('publish', result)} --confirm`)}.`,
]

const manualSteps = (result: Outcome) => [
  imported(result) > 0
    ? `Review the meters, benefits and products in ${result.file}`
    : `Describe your meters, benefits and products in ${result.file}`,
  configCommand('plan', result),
  configCommand('apply', result),
]

const nextSteps = (result: Outcome) => [
  ...(result.install && result.install.status !== 'installed'
    ? [result.install.command]
    : []),
  ...(result.caller === undefined
    ? manualSteps(result)
    : agentSteps(result, PLAIN)),
]

const importedSummary = ({ imported }: Pick<Written, 'imported'>) =>
  [
    plural(imported.meters, 'meter'),
    plural(imported.benefits, 'benefit'),
    plural(imported.products, 'product'),
  ].join(', ')

const keyedLines = (keyed: Written['keyed']) =>
  keyed.length === 0
    ? []
    : section(
        'External IDs',
        keyed
          .map(
            ({ resource, name, external_id }) =>
              `${ui.INDENT}${ui.green('+')} ${ui.printable(external_id)} ${ui.dim(`${resource} ${ui.printable(name)}`)}`,
          )
          .join('\n'),
      )

const skippedLines = (skipped: Written['skipped']) =>
  skipped.length === 0
    ? []
    : [
        ui.blank,
        ui.warning(
          `Not in the config: ${plural(skipped.length, 'resource')} it cannot manage yet`,
        ),
        ...skipped.map(
          ({ resource, name, id, reason }) =>
            `${ui.INDENT}${ui.INDENT}${ui.printable(name)} ${ui.dim(`(${resource} ${id}) ${SKIP_REASONS[reason] ?? reason}`)}`,
        ),
      ]

const installLines = (install: Written['install']) =>
  install === undefined
    ? []
    : [
        [
          'Package',
          `${packageOf(install.command.split(' '))} ${install.status === 'installed' ? 'installed' : 'not installed'}`,
        ] as const,
      ]

const alreadyEnabledLines = (result: Written) =>
  result.already_enabled
    ? [
        ui.blank,
        ui.warning(
          `${result.organization.name} already manages its catalog as code`,
        ),
        `${ui.INDENT}${ui.INDENT}${ui.dim(`${result.file} is a snapshot of it. If another config file applies to ${result.organization.name}, keep only one.`)}`,
      ]
    : []

const installStep = ({ install }: Pick<Written, 'install'>) =>
  install && install.status !== 'installed'
    ? [`Install the config package: ${ui.command(install.command)}`]
    : []

const agentName = (agents: Written['agents']) =>
  agents?.names.length === 1 ? agents.names[0]! : 'your coding agent'

const CONFIG_DOCS = 'https://polar.sh/docs/integrate/cli/config'

type Rows = ReadonlyArray<readonly [string, string]>

const options = (entries: ReadonlyArray<readonly [string, Rows]>) => {
  const width = Math.max(
    ...entries.flatMap(([, rows]) => rows.map(([label]) => label.length)),
  )
  return entries.flatMap(([title, rows], number) => [
    ui.blank,
    ui.heading(`${ui.dim(`Option ${number + 1}`)}  ${title}`),
    ...ui
      .keyValue(
        rows.map(([label, value], index) => [
          `${index + 1}  ${label.padEnd(width)}`,
          value,
        ]),
      )
      .split('\n')
      .map((row) => `${ui.INDENT}${row}`),
  ])
}

const guideLines = (result: Written) => {
  const existing = imported(result) > 0
  const file = ui.bold(result.file)
  const plan = ui.command(configCommand('plan', result))
  const apply = ui.command(configCommand('apply', result))
  const docs = ['Read the docs', ui.cyan(CONFIG_DOCS)] as const
  return [
    ui.blank,
    ui.heading('Next'),
    `${ui.INDENT}${
      existing
        ? 'Your config matches what is on Polar. Pick one way to continue.'
        : 'Your config is empty. Pick one way to fill it in.'
    }`,
    ...installStep(result).map((line) => `${ui.INDENT}${line}`),
    ...options([
      [
        `Hand it to ${agentName(result.agents)}`,
        [
          ...(result.agents?.ready === false
            ? [['Set up the agent', ui.command('polar agent setup')] as const]
            : []),
          ['Ask it', '"Help me set up billing with my Polar config"'],
        ],
      ],
      [
        'Do it yourself',
        existing
          ? [
              docs,
              ['Edit the config', file],
              ['Preview the change', plan],
              ['Apply it', apply],
            ]
          : [
              docs,
              ['Add your meters, benefits and products', file],
              ['Preview what would be created', plan],
              ['Create it on Polar', apply],
            ],
      ],
    ]),
  ]
}

const agentLines = (result: Written) => [
  ui.blank,
  ui.heading('Next'),
  ...[...installStep(result), ...agentSteps(result, HIGHLIGHTED)].map(
    (step, index) => `${ui.INDENT}${ui.INDENT}${index + 1}  ${step}`,
  ),
]

const renderWritten = (result: Written) => [
  ui.success('Your billing config is ready'),
  `${ui.INDENT}${ui.INDENT}${ui.dim('Nice work, your billing now lives in code')}`,
  ...alreadyEnabledLines(result),
  ...section(
    'Summary',
    ui.keyValue([
      ['Organization', result.organization.name],
      ['Environment', result.organization.environment],
      ['File', result.file],
      ['Imported', importedSummary(result)],
      ...installLines(result.install),
    ]),
  ),
  ...keyedLines(result.keyed),
  ...skippedLines(result.skipped),
  ...(result.caller === undefined ? guideLines(result) : agentLines(result)),
  ui.blank,
]

const RERUN = [
  'polar config init --confirm',
  'polar config init --confirm --external-id <id>=<external ID>',
]

const renderRequired = (result: Required) => [
  ui.blank,
  ui.warning(
    `${plural(result.external_ids.length, 'resource')} in ${result.organization.name} need an external ID`,
  ),
  ...result.external_ids.map(
    ({ resource, id, name, external_id }) =>
      `${ui.INDENT}${ui.INDENT}${ui.printable(external_id)} ${ui.dim(`${resource} ${ui.printable(name)} (${id})`)}`,
  ),
  ...section(
    'Next',
    [
      `${ui.INDENT}Use these suggestions with ${ui.command(result.next[0]!)}`,
      `${ui.INDENT}Override some of them with ${ui.command(result.next[1]!)}`,
    ].join('\n'),
  ),
  ui.blank,
]

const render = (result: Init) =>
  result.status === 'written' ? renderWritten(result) : renderRequired(result)

export const init = Command.make('init', {
  file,
  org,
  sandbox,
  production,
  local,
  format,
  skipInstall,
  confirm: acceptSuggestions,
  externalIds,
}).pipe(
  Command.withDescription(
    "Create a billing config file from your organization's meters, benefits and products, and show what to do next",
  ),
  Command.withExamples([
    {
      command: 'polar config init',
      description:
        'Write a config for the active organization at the root of your project',
    },
    {
      command: 'polar config init --sandbox',
      description:
        'Set up your sandbox organization, logging in first if needed',
    },
    {
      command: 'polar config init --org acme --format json',
      description: 'Write a JSON config for another organization',
    },
    {
      command: 'polar config init --json --confirm',
      description:
        'Use the suggested external IDs for existing resources that have none, for scripts and agents',
    },
    {
      command: 'polar config init --json --external-id <id>=pro',
      description:
        'Choose the external ID of an existing resource; init --json lists the IDs that need one',
    },
    {
      command: 'polar config init billing/polar.config.ts --json',
      description:
        'Write to a specific path and print the result as JSON, for scripts and agents',
    },
  ]),
  output({
    result: Init,
    run: (
      {
        file,
        org,
        sandbox,
        production,
        local,
        format,
        skipInstall,
        confirm,
        externalIds,
      },
      { say },
    ) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const fs = yield* FileSystem.FileSystem
        const { json } = yield* Output
        const prompt = !json && (yield* interactive)
        const given = yield* parseExternalIds(externalIds)
        yield* say([
          ui.blank,
          ...banner([
            ui.bold('polar config init'),
            ui.dim('Set up a billing config for your organization'),
          ]),
          ui.blank,
        ])
        return yield* withProgress((progress) =>
          Effect.gen(function* () {
            yield* progress.start('Resolving organization')
            const organization = yield* resolveOrganization(
              { sandbox, production, local },
              Option.getOrUndefined(org),
              prompt,
            )
            yield* progress.finish(target(organization))
            const path = Option.getOrUndefined(file)
            const directory =
              path === undefined ? yield* projectDirectory(fs) : process.cwd()
            const chosen =
              Option.getOrUndefined(format) ??
              (path === undefined
                ? yield* detectFormat(fs, directory, prompt, progress)
                : undefined)
            yield* progress.start('Reading your catalog')
            const outcome = yield* billing
              .init(
                organization,
                {
                  directory,
                  file: path,
                  format: chosen,
                },
                nameResources({ prompt, confirm, given }, progress, say),
              )
              .pipe(
                Effect.map((prepared) => ({ prepared })),
                Effect.catchTag('ExternalIdsRequired', ({ proposed }) =>
                  Effect.succeed({ proposed }),
                ),
              )
            if ('proposed' in outcome) {
              return {
                status: 'external_ids_required',
                organization,
                external_ids: outcome.proposed,
                next: RERUN,
              } satisfies Required
            }
            const { prepared } = outcome
            yield* progress.finish(prepared.file)
            const install = yield* installPackage(
              billing.install,
              prepared.install,
              prepared.installDirectory ?? directory,
              prompt,
              skipInstall,
              progress,
              say,
            )
            const selected = yield* (yield* Organizations).selected.pipe(
              Effect.orElseSucceed(() => undefined),
            )
            const active =
              selected?.id === organization.id &&
              selected.environment === organization.environment
            const setup = yield* AgentSetup
            const caller = setup.callingAgent?.name
            yield* progress.start('Detecting who is running this')
            const agents =
              caller === undefined ? yield* detectAgents(setup) : undefined
            yield* progress.finish(
              caller === undefined ? 'A human' : `An agent, ${caller}`,
            )
            const result = {
              file: prepared.file,
              format: prepared.format,
              imported: prepared.imported,
              keyed: prepared.keyed,
              skipped: prepared.skipped,
              already_enabled: prepared.already_enabled,
              ...(install ? { install } : {}),
              ...(active ? {} : { org: organization.id }),
              ...(caller ? { caller } : {}),
              ...(agents ? { agents } : {}),
              organization,
            }
            return {
              status: 'written',
              ...result,
              next: nextSteps(result),
            } satisfies Written
          }),
        )
      }),
    render,
    failed: (result) =>
      result.status === 'external_ids_required'
        ? new BillingConfigError({
            message: 'Nothing was written: some resources need an external ID',
            hint: 'Pass --confirm to use the suggestions, or --external-id <id>=<external ID> for each.',
          })
        : undefined,
  }),
)

const installPackage = (
  run: Run,
  command: ReadonlyArray<string> | undefined,
  directory: string,
  prompt: boolean,
  skip: boolean,
  progress: Progress,
  say: (lines: ReadonlyArray<string>) => Effect.Effect<void>,
) =>
  Effect.gen(function* () {
    if (command === undefined) return undefined
    const text = command.join(' ')
    if (!(yield* confirmInstall(command, prompt, skip))) {
      return { command: text, status: 'skipped' } as const
    }
    yield* progress.start(`Installing ${packageOf(command)}`)
    const ran = yield* run(command, directory)
    yield* ran.ok ? progress.finish(text) : progress.fail(text)
    const printed = ranOutput(ran)
    if (!ran.ok && printed) {
      yield* say([ui.blank, ...printed.split('\n').map(ui.step)])
    }
    return { command: text, status: ran.ok ? 'installed' : 'failed' } as const
  })
