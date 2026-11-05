import { Effect, FileSystem, Option, Schema, Stdio } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import { announceAuthorization } from '@/commands/auth'
import {
  ActiveOrganization,
  AuthError,
  loginCommand,
  PolarEnvironment,
} from '@/schemas/Auth'
import { DEFAULT_CONFIG_FILES, InitResult } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import {
  BillingConfig,
  type Prepared,
  type Run,
} from '@/services/billing-config/service'
import { Organizations } from '@/services/organizations'
import { findProjectRoot, PACKAGE } from '@/utils/billing-config/project'
import { banner } from '@/utils/logo'
import { confirm, select } from '@/utils/prompt'
import { section, target } from '@/utils/billing-config/review'
import { FORMATS } from '@/utils/billing-config/templates'
import { output } from '@/utils/command'
import { local, org, production, sandbox } from '@/utils/flags'
import { Output } from '@/utils/output'
import { type Progress, withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Where to write the config. Defaults to polar.config.ts at the root of a JavaScript or TypeScript project, polar.config.json otherwise',
  ),
  Argument.optional,
)

const format = Flag.Literals('format', FORMATS).pipe(
  Flag.optional,
  Flag.withDescription(
    'Write TypeScript (ts) or JSON (json). Detected from your project when omitted: ts when there is a package.json, json otherwise',
  ),
)

const skipInstall = Flag.Boolean('skip-install').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    `Do not install ${PACKAGE}, which a TypeScript config imports`,
  ),
)

const Init = Schema.Struct({
  ...InitResult.fields,
  organization: ActiveOrganization,
  next: Schema.Array(Schema.String),
})
type Init = typeof Init.Type

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

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
  Effect.map(
    findProjectRoot(fs, process.cwd()),
    (root) => root ?? process.cwd(),
  )

const confirmInstall = (command: string, prompt: boolean, skip: boolean) =>
  skip
    ? Effect.succeed(false)
    : prompt
      ? confirm(`Install ${PACKAGE} with ${ui.command(command)} now?`)
      : Effect.succeed(true)

const configCommand = (command: 'plan' | 'apply', file: string) =>
  (DEFAULT_CONFIG_FILES as ReadonlyArray<string>).includes(file)
    ? `polar config ${command}`
    : `polar config ${command} ${file}`

const nextSteps = (result: Omit<Init, 'next'>) => [
  ...(result.install && result.install.status !== 'installed'
    ? [result.install.command]
    : []),
  `Describe your meters, benefits and products in ${result.file}`,
  configCommand('plan', result.file),
  configCommand('apply', result.file),
]

const installLines = (install: Init['install']) =>
  install === undefined
    ? []
    : install.status === 'installed'
      ? [['Package', `${PACKAGE} installed`] as const]
      : [['Package', `${PACKAGE} not installed`] as const]

const render = (result: Init) => [
  ui.success('Your billing config is ready'),
  ...section(
    'Summary',
    ui.keyValue([
      ['Organization', result.organization.name],
      ['Environment', result.organization.environment],
      ['File', result.file],
      ...installLines(result.install),
    ]),
  ),
  ...section(
    'Next',
    [
      ...(result.install && result.install.status !== 'installed'
        ? [
            `${ui.INDENT}Install the config package: ${ui.command(result.install.command)}`,
          ]
        : []),
      `${ui.INDENT}Describe your meters, benefits and products in ${ui.bold(result.file)}`,
      `${ui.INDENT}Preview what would be created with ${ui.command(configCommand('plan', result.file))}`,
      `${ui.INDENT}Create it on Polar with ${ui.command(configCommand('apply', result.file))}`,
    ].join('\n'),
  ),
  ui.blank,
]

export const init = Command.make('init', {
  file,
  org,
  sandbox,
  production,
  local,
  format,
  skipInstall,
}).pipe(
  Command.withDescription(
    'Create a billing config file for your organization and show what to do next',
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
      command: 'polar config init billing/polar.config.ts --json',
      description:
        'Write to a specific path and print the result as JSON, for scripts and agents',
    },
  ]),
  output({
    result: Init,
    run: (
      { file, org, sandbox, production, local, format, skipInstall },
      { say },
    ) =>
      Effect.gen(function* () {
        const billing = yield* BillingConfig
        const fs = yield* FileSystem.FileSystem
        const { json } = yield* Output
        const prompt = !json && (yield* interactive)
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
            yield* progress.start('Writing config')
            const prepared: Prepared = yield* billing.init(organization, {
              directory,
              file: path,
              format: Option.getOrUndefined(format),
            })
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
            const result = {
              file: prepared.file,
              format: prepared.format,
              ...(install ? { install } : {}),
              organization,
            }
            return { ...result, next: nextSteps(result) }
          }),
        )
      }),
    render,
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
    if (!(yield* confirmInstall(text, prompt, skip))) {
      return { command: text, status: 'skipped' } as const
    }
    yield* progress.start(`Installing ${PACKAGE}`)
    const ran = yield* run(command, directory)
    yield* ran.ok ? progress.finish(text) : progress.fail(text)
    if (!ran.ok && ran.output) {
      yield* say([ui.blank, ...ran.output.split('\n').map(ui.step)])
    }
    return { command: text, status: ran.ok ? 'installed' : 'failed' } as const
  })
