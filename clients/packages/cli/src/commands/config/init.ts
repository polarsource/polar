import { relative } from 'node:path'
import { Effect, FileSystem, Option, Schema, Stdio } from 'effect'
import { Argument, Command, Flag } from 'effect/cli'
import { announceAuthorization } from '@/commands/auth'
import {
  ActiveOrganization,
  AuthError,
  loginCommand,
  PolarEnvironment,
} from '@/schemas/Auth'
import { InitResult } from '@/schemas/BillingConfig'
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
import {
  type Format,
  FORMATS,
  formatOf,
  type Template,
  TEMPLATES,
} from '@/utils/billing-config/templates'
import { output } from '@/utils/command'
import { local, org, production, sandbox } from '@/utils/flags'
import { Output } from '@/utils/output'
import { type Progress, withProgress } from '@/utils/progress'
import * as ui from '@/utils/ui'

const file = Argument.String('file').pipe(
  Argument.withDescription(
    'Where to write the config. Defaults to polar.config.ts at the root of your project, or polar.config.json with --format json',
  ),
  Argument.optional,
)

const format = Flag.Literals('format', FORMATS).pipe(
  Flag.optional,
  Flag.withDescription(
    'Write TypeScript (ts) or JSON (json). Asked interactively when omitted, ts otherwise',
  ),
)

const template = Flag.Literals('template', TEMPLATES).pipe(
  Flag.optional,
  Flag.withDescription(
    'Start empty, or from a demo with a meter, a benefit and two products. Asked interactively when omitted, empty otherwise',
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

const login = (prompt: boolean) =>
  Effect.gen(function* () {
    if (!prompt) {
      return yield* new AuthError({
        message: `Not logged in. Run ${loginCommand('sandbox')} or ${loginCommand('production')} first.`,
      })
    }
    const environment = yield* pickEnvironment
    yield* (yield* Auth).login(
      environment,
      false,
      announceAuthorization(environment),
    )
    return environment
  })

const resolveOrganization = (
  flags: EnvironmentFlags,
  reference: string | undefined,
  prompt: boolean,
) =>
  Effect.gen(function* () {
    const organizations = yield* Organizations
    const environment = yield* chosenEnvironment(flags)
    if (reference !== undefined) {
      const organization = yield* organizations.resolve(reference)
      if (
        environment !== undefined &&
        organization.environment !== environment
      ) {
        return yield* new AuthError({
          message: `${organization.slug} is in ${organization.environment}, not ${environment}.`,
        })
      }
      return organization
    }
    if (environment !== undefined) {
      return yield* pickOrganization(environment, prompt)
    }
    const auth = yield* Auth
    if ((yield* auth.environments).length === 0 && !(yield* auth.override)) {
      return yield* pickOrganization(yield* login(prompt), prompt)
    }
    return yield* organizations.resolve()
  })

const choose = <A extends string, E, R>(
  prompt: boolean,
  given: Option.Option<A>,
  fallback: A,
  ask: Effect.Effect<A, E, R>,
) =>
  Option.isSome(given)
    ? Effect.succeed(given.value)
    : prompt
      ? ask
      : Effect.succeed(fallback)

const FORMAT_TITLES: Record<Format, string> = { ts: 'TypeScript', json: 'JSON' }

const formatPrompt = select<Format>(
  {
    message: 'Which format do you want?',
    choices: [
      {
        title: FORMAT_TITLES.ts,
        value: 'ts',
        description: `polar.config.ts, typed with ${PACKAGE}`,
      },
      {
        title: FORMAT_TITLES.json,
        value: 'json',
        description: 'polar.config.json',
      },
    ],
  },
  (format) => FORMAT_TITLES[format],
)

const TEMPLATE_TITLES: Record<Template, string> = {
  empty: 'Empty',
  demo: 'Demo',
}

const templatePrompt = select<Template>(
  {
    message: 'Where do you want to start?',
    choices: [
      {
        title: TEMPLATE_TITLES.empty,
        value: 'empty',
        description: 'Just the sections',
      },
      {
        title: TEMPLATE_TITLES.demo,
        value: 'demo',
        description: 'A usage meter, a credits benefit, and Free and Pro plans',
      },
    ],
  },
  (template) => TEMPLATE_TITLES[template],
)

const chooseDirectory = (fs: FileSystem.FileSystem, prompt: boolean) =>
  Effect.gen(function* () {
    const cwd = process.cwd()
    const root = yield* findProjectRoot(fs, cwd)
    if (root === undefined || root === cwd) return cwd
    if (!prompt) return root
    return yield* select<string>(
      {
        message: 'Where should the config live?',
        choices: [
          {
            title: `Project root ${ui.dim('(recommended)')}`,
            value: root,
            description: relative(cwd, root),
          },
          { title: 'This directory', value: cwd, description: '.' },
        ],
      },
      (directory) =>
        directory === cwd ? 'This directory' : relative(cwd, directory),
    )
  })

const confirmInstall = (command: string, prompt: boolean, skip: boolean) =>
  skip
    ? Effect.succeed(false)
    : prompt
      ? confirm(`Install ${PACKAGE} with ${ui.command(command)} now?`)
      : Effect.succeed(true)

const nextSteps = (result: Omit<Init, 'next'>) => [
  ...(result.install && result.install.status !== 'installed'
    ? [result.install.command]
    : []),
  result.template === 'empty'
    ? `Describe your meters, benefits and products in ${result.file}`
    : `Adjust the demo in ${result.file} to your own pricing`,
  'polar config plan',
  'polar config apply',
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
      ['Template', result.template],
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
      `${ui.INDENT}${
        result.template === 'empty'
          ? `Describe your meters, benefits and products in ${ui.bold(result.file)}`
          : `Adjust the demo in ${ui.bold(result.file)} to your own pricing`
      }`,
      `${ui.INDENT}Preview what would be created with ${ui.command('polar config plan')}`,
      `${ui.INDENT}Create it on Polar with ${ui.command('polar config apply')}`,
    ].join('\n'),
  ),
  ui.blank,
]

const fileFormat = (path: string | undefined) =>
  Option.fromUndefinedOr(path === undefined ? undefined : formatOf(path))

export const init = Command.make('init', {
  file,
  org,
  sandbox,
  production,
  local,
  format,
  template,
  skipInstall,
}).pipe(
  Command.withDescription(
    'Create a billing config file for your organization and show what to do next',
  ),
  Command.withExamples([
    {
      command: 'polar config init',
      description:
        'Write polar.config.ts for the active organization, asking about format and template',
    },
    {
      command: 'polar config init --sandbox',
      description:
        'Set up your sandbox organization, logging in first if needed',
    },
    {
      command: 'polar config init --org acme --format json --template demo',
      description:
        'Write a JSON demo config for another organization, without asking',
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
      { file, org, sandbox, production, local, format, template, skipInstall },
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
              path === undefined
                ? yield* chooseDirectory(fs, prompt)
                : process.cwd()
            const chosenFormat = yield* choose(
              prompt && Option.isNone(fileFormat(path)),
              Option.isSome(format) ? format : fileFormat(path),
              'ts',
              formatPrompt,
            )
            const chosenTemplate = yield* choose(
              prompt,
              template,
              'empty',
              templatePrompt,
            )
            yield* progress.start('Writing config')
            const prepared: Prepared = yield* billing.init(organization, {
              directory,
              file: path,
              format: chosenFormat,
              template: chosenTemplate,
            })
            yield* progress.finish(prepared.file)
            const install = yield* installPackage(
              billing.install,
              prepared.install,
              directory,
              prompt,
              skipInstall,
              progress,
              say,
            )
            const result = {
              file: prepared.file,
              format: prepared.format,
              template: prepared.template,
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
