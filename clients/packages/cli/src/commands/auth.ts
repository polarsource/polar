import { Console, Effect, Stdio } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import {
  AuthError,
  environments,
  loginCommand,
  orgCommand,
  type ActiveOrganization,
  type OrganizationSelection,
  type PolarEnvironment,
} from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import * as ui from '@/utils/ui'
import { production, sandbox } from '@/commands/flags'

const isSelected = (
  organization: ActiveOrganization,
  selection: OrganizationSelection | undefined,
) =>
  selection?.id === organization.id &&
  selection.environment === organization.environment

const describe = (organization: ActiveOrganization) =>
  `${ui.bold(organization.name)} ${ui.dim(organization.slug)} ${ui.dim(organization.environment)}`

const notLoggedIn = Effect.gen(function* () {
  yield* Console.log(ui.warning('Not logged in'))
  yield* Console.log(
    ui.step(
      `Run ${ui.command(loginCommand('sandbox'))} or ${ui.command(loginCommand('production'))}`,
    ),
  )
  yield* Console.log(ui.blank)
})

const environmentFlags = { sandbox, production }

const interactive = Effect.gen(function* () {
  const stdio = yield* Stdio.Stdio
  return (yield* stdio.stdinIsTerminal) && (yield* stdio.stdoutIsTerminal)
})

const chooseEnvironment = (
  flags: { sandbox: boolean; production: boolean },
  action: string,
) =>
  Effect.gen(function* () {
    if (flags.sandbox && flags.production) {
      return yield* new AuthError({
        message: 'Pass either --sandbox or --production, not both.',
      })
    }
    if (flags.production) return 'production' as const
    if (flags.sandbox) return 'sandbox' as const
    if (!(yield* interactive)) {
      return yield* new AuthError({
        message: `Pass --sandbox or --production to ${action} outside an interactive terminal.`,
      })
    }
    return yield* Prompt.select<PolarEnvironment>({
      message: `Which environment do you want to ${action}?`,
      choices: [
        { title: 'Sandbox', value: 'sandbox', description: 'sandbox.polar.sh' },
        { title: 'Production', value: 'production', description: 'polar.sh' },
      ],
    })
  })

const selectOrganization = Effect.gen(function* () {
  const organizations = yield* Organizations
  const items = yield* organizations.listAll
  if (items.length === 0) {
    yield* Console.log(ui.warning('No organizations yet'))
    yield* Console.log(
      ui.step(
        `Create one at ${ui.cyan('https://polar.sh')} or ${ui.cyan('https://sandbox.polar.sh')}, then run ${ui.command(orgCommand)}`,
      ),
    )
    yield* Console.log(ui.blank)
    return
  }
  if (!(yield* interactive)) {
    yield* Console.log(
      ui.warning('Organization selection requires an interactive terminal'),
    )
    yield* Console.log(
      ui.step(
        `Run ${ui.command(orgCommand)} interactively, or use POLAR_ACCESS_TOKEN with ${ui.command('--org <id>')} in CI`,
      ),
    )
    yield* Console.log(ui.blank)
    return
  }
  const selection = yield* organizations.selected
  const organization = yield* Prompt.select({
    message: 'Select organization',
    choices: items.map((organization) => ({
      value: organization,
      title: `${organization.name} ${ui.dim(organization.environment)}${isSelected(organization, selection) ? ` ${ui.dim('(active)')}` : ''}`,
      description: organization.slug,
    })),
  })
  yield* organizations.select({
    id: organization.id,
    environment: organization.environment,
  })
  yield* Console.log(ui.blank)
  yield* Console.log(
    ui.success(`Active organization ${describe(organization)}`),
  )
  yield* Console.log(ui.blank)
})

const login = Command.make(
  'login',
  {
    ...environmentFlags,
    newSession: Flag.boolean('new-session').pipe(
      Flag.withDefault(false),
      Flag.withDescription('Sign in again even if a session is already saved'),
    ),
  },
  ({ newSession, ...flags }) =>
    Effect.gen(function* () {
      const environment = yield* chooseEnvironment(flags, 'log in to')
      const auth = yield* Auth
      const replaced = yield* auth.login(environment, newSession)
      if (!replaced) {
        const other: PolarEnvironment =
          environment === 'production' ? 'sandbox' : 'production'
        yield* Console.log(ui.blank)
        yield* Console.log(
          ui.warning(`Already logged in to ${ui.bold(environment)}`),
        )
        yield* Console.log(
          ui.step(
            `Run ${ui.command(`${loginCommand(environment)} --new-session`)} to sign in again`,
          ),
        )
        yield* Console.log(
          ui.step(
            `Run ${ui.command(loginCommand(other))} to sign in to ${other}`,
          ),
        )
        yield* Console.log(ui.blank)
        return
      }
      yield* Console.log(
        ui.success(`Logged in to Polar ${ui.bold(environment)}`),
      )
      yield* Console.log(ui.blank)
      yield* selectOrganization
    }),
).pipe(Command.withDescription('Sign in to Polar through your browser'))

const whoami = Command.make('whoami', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const organizations = yield* Organizations
    const environments = yield* auth.environments
    yield* Console.log(ui.blank)
    if (yield* auth.override) {
      const rows: Array<readonly [string, string]> = [
        ['Token', 'POLAR_ACCESS_TOKEN'],
        ['Environment', environments[0]!],
      ]
      const items = yield* organizations.listAll
      const organization = items.length === 1 ? items[0] : undefined
      if (organization) {
        rows.push(['Organization', describe(organization)])
        rows.push(['ID', ui.dim(organization.id)])
      }
      yield* Console.log(ui.keyValue(rows))
      if (!organization) {
        yield* Console.log(ui.blank)
        yield* Console.log(ui.warning('No active organization'))
        yield* Console.log(
          ui.step(
            `Use ${ui.command('--org <id>')} on organization-dependent commands`,
          ),
        )
      }
      yield* Console.log(ui.blank)
      return
    }
    if (environments.length === 0) return yield* notLoggedIn
    const rows: Array<readonly [string, string]> = [
      ['Logged in', environments.join(', ')],
    ]
    const selection = yield* organizations.selected
    if (selection) {
      const organization = yield* organizations.resolve()
      rows.push(['Organization', describe(organization)])
      rows.push(['ID', ui.dim(organization.id)])
    }
    yield* Console.log(ui.keyValue(rows))
    if (!selection) {
      yield* Console.log(ui.blank)
      yield* Console.log(ui.warning('No active organization'))
      yield* Console.log(ui.step(`Run ${ui.command(orgCommand)} to choose one`))
    }
    yield* Console.log(ui.blank)
  }),
).pipe(Command.withDescription('Show your sessions and active organization'))

const list = Command.make('list', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const organizations = yield* Organizations
    const environments = yield* auth.environments
    const override = yield* auth.override
    yield* Console.log(ui.blank)
    if (environments.length === 0) return yield* notLoggedIn
    const selection = yield* organizations.selected
    for (const environment of environments) {
      const items = yield* organizations.list(environment)
      yield* Console.log(
        `  ${ui.bold(`Organizations in ${environment}`)}${override ? ui.dim('  via POLAR_ACCESS_TOKEN') : ''}`,
      )
      yield* Console.log(ui.blank)
      if (items.length === 0) {
        yield* Console.log(ui.step('No accessible organizations'))
      }
      const width = Math.max(0, ...items.map((org) => org.name.length))
      for (const org of items) {
        const marker = isSelected(org, selection) ? ui.green('●') : ui.dim('○')
        yield* Console.log(
          `  ${marker} ${org.name.padEnd(width)}  ${ui.dim(org.slug)}  ${ui.dim(org.id)}`,
        )
      }
      yield* Console.log(ui.blank)
    }
  }),
).pipe(Command.withDescription('List the organizations you have access to'))

const org = Command.make('org', {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth
    if (yield* auth.override) {
      return yield* new AuthError({
        message: 'Unset POLAR_ACCESS_TOKEN to manage saved sessions.',
      })
    }
    if ((yield* auth.environments).length === 0) {
      return yield* new AuthError({
        message: `Not logged in. Run ${loginCommand('sandbox')} or ${loginCommand('production')}.`,
      })
    }
    yield* selectOrganization
  }),
).pipe(Command.withDescription('Choose the active organization'))

const logoutTargets = (flags: {
  sandbox: boolean
  production: boolean
  all: boolean
}) =>
  Effect.gen(function* () {
    if (flags.all) return [...environments]
    if (flags.sandbox || flags.production) {
      return environments.filter((environment) => flags[environment])
    }
    if (!(yield* interactive)) {
      return yield* new AuthError({
        message:
          'Pass --sandbox, --production or --all to log out outside an interactive terminal.',
      })
    }
    const auth = yield* Auth
    const sessions = yield* auth.savedEnvironments
    if (sessions.length === 0) return []
    const choices = sessions.map((environment) => ({
      title: environment === 'production' ? 'Production' : 'Sandbox',
      value: [environment] as PolarEnvironment[],
    }))
    if (sessions.length > 1) {
      choices.push({ title: 'All sessions', value: [...sessions] })
    }
    return yield* Prompt.select({
      message: 'Which session do you want to log out of?',
      choices,
    })
  })

const logout = Command.make(
  'logout',
  {
    ...environmentFlags,
    all: Flag.boolean('all').pipe(
      Flag.withDefault(false),
      Flag.withDescription('Remove every saved session'),
    ),
  },
  (flags) =>
    Effect.gen(function* () {
      const auth = yield* Auth
      yield* Console.log(ui.blank)
      if (yield* auth.override) {
        yield* Console.log(ui.warning('POLAR_ACCESS_TOKEN remains active'))
        yield* Console.log(
          ui.step(
            'Unset it to stop using the override, only saved sessions are removed',
          ),
        )
      }
      const targets = yield* logoutTargets(flags)
      const deleted = yield* auth.logout(targets)
      for (const environment of targets) {
        yield* Console.log(
          deleted.includes(environment)
            ? ui.success(`Logged out of Polar ${ui.bold(environment)}`)
            : ui.step(`Already logged out of ${environment}`),
        )
      }
      if (targets.length === 0) {
        yield* Console.log(ui.step('Already logged out'))
      }
      yield* Console.log(ui.blank)
    }),
).pipe(Command.withDescription('Sign out and remove saved sessions'))

export const auth = Command.make('auth').pipe(
  Command.withDescription('Manage your Polar sessions and active organization'),
  Command.withSubcommands([login, whoami, list, org, logout]),
)
