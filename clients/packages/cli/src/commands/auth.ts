import { Effect, Schema, Stdio } from 'effect'
import { Command, Flag, Prompt } from 'effect/cli'
import {
  ActiveOrganization,
  AuthError,
  environments,
  loginCommand,
  orgCommand,
  type OrganizationSelection,
  PolarEnvironment,
} from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { Organizations } from '@/services/organizations'
import { output } from '@/utils/command'
import { production, sandbox } from '@/utils/flags'
import { note } from '@/utils/progress'
import * as ui from '@/utils/ui'

const isSelected = (
  organization: ActiveOrganization,
  selection: OrganizationSelection | undefined,
) =>
  selection?.id === organization.id &&
  selection.environment === organization.environment

const describe = (organization: ActiveOrganization) =>
  `${ui.bold(organization.name)} ${ui.dim(organization.slug)} ${ui.dim(organization.environment)}`

const organizationRows = (
  organization: ActiveOrganization,
): Array<readonly [string, string]> => [
  ['Organization', ui.bold(organization.name)],
  ['Slug', organization.slug],
  ['Environment', organization.environment],
  ['ID', ui.dim(organization.id)],
]

const notLoggedIn = [
  ui.warning('Not logged in'),
  ui.step(
    `Run ${ui.command(loginCommand('sandbox'))} or ${ui.command(loginCommand('production'))}`,
  ),
  ui.blank,
]

const environmentFlags = { sandbox, production }

const announceAuthorization =
  (environment: PolarEnvironment) => (authorization: URL) =>
    note(
      [
        ui.blank,
        ui.step(`Opening your browser to sign in to Polar ${environment}...`),
        ui.step('If it does not open, visit:'),
        `    ${ui.cyan(authorization.toString())}`,
        ui.blank,
        ui.step('Waiting for you to authorize the CLI...'),
        ui.blank,
      ].join('\n'),
    )

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
    return yield* Prompt.Select<PolarEnvironment>({
      message: `Which environment do you want to ${action}?`,
      choices: [
        { title: 'Sandbox', value: 'sandbox', description: 'sandbox.polar.sh' },
        { title: 'Production', value: 'production', description: 'polar.sh' },
      ],
    })
  })

const Selection = Schema.Union([
  Schema.Struct({
    status: Schema.Literal('activated'),
    organization: ActiveOrganization,
  }),
  Schema.Struct({ status: Schema.Literal('none') }),
  Schema.Struct({ status: Schema.Literal('needs-terminal') }),
])
type Selection = typeof Selection.Type

const Login = Schema.Struct({
  environment: PolarEnvironment,
  replaced: Schema.Boolean,
  selection: Schema.optional(Selection),
})

const Identity = Schema.Struct({
  source: Schema.Literals(['POLAR_ACCESS_TOKEN', 'session']),
  environments: Schema.Array(PolarEnvironment),
  organization: Schema.NullOr(ActiveOrganization),
})
type Identity = typeof Identity.Type

const Listed = Schema.Struct({
  ...ActiveOrganization.fields,
  active: Schema.Boolean,
})

const Listing = Schema.Struct({
  override: Schema.Boolean,
  environments: Schema.Array(PolarEnvironment),
  items: Schema.Array(Listed),
})
type Listing = typeof Listing.Type

const Logout = Schema.Struct({
  overrideActive: Schema.Boolean,
  targets: Schema.Array(PolarEnvironment),
  deleted: Schema.Array(PolarEnvironment),
})

const activate = (organization: ActiveOrganization) =>
  Effect.gen(function* () {
    const organizations = yield* Organizations
    yield* organizations.select({
      id: organization.id,
      environment: organization.environment,
    })
    return { status: 'activated', organization } satisfies Selection
  })

const selectOrganization = Effect.gen(function* () {
  const organizations = yield* Organizations
  const items = yield* organizations.listAll
  if (items.length === 0) return { status: 'none' } satisfies Selection
  if (items.length === 1) return yield* activate(items[0]!)
  if (!(yield* interactive)) {
    return { status: 'needs-terminal' } satisfies Selection
  }
  const selection = yield* organizations.selected
  const organization = yield* Prompt.Select({
    message: 'Select organization',
    choices: items.map((organization) => ({
      value: organization,
      title: `${organization.name} ${ui.dim(organization.environment)}${isSelected(organization, selection) ? ` ${ui.dim('(active)')}` : ''}`,
      description: organization.slug,
    })),
  })
  return yield* activate(organization)
})

const selectionLines = (selection: Selection) => {
  switch (selection.status) {
    case 'activated':
      return [
        ui.blank,
        ui.success(`Active organization ${describe(selection.organization)}`),
        ui.blank,
      ]
    case 'none':
      return [
        ui.warning('No organizations yet'),
        ui.step(
          `Create one at ${ui.cyan('https://polar.sh')} or ${ui.cyan('https://sandbox.polar.sh')}, then run ${ui.command(orgCommand)}`,
        ),
        ui.blank,
      ]
    case 'needs-terminal':
      return [
        ui.warning('Organization selection requires an interactive terminal'),
        ui.step(
          `Run ${ui.command(orgCommand)} interactively, or use POLAR_ACCESS_TOKEN with ${ui.command('--org <id>')} in CI`,
        ),
        ui.blank,
      ]
  }
}

const login = Command.make('login', {
  ...environmentFlags,
  newSession: Flag.Boolean('new-session').pipe(
    Flag.withDefault(false),
    Flag.withDescription('Sign in again even if a session is already saved'),
  ),
}).pipe(
  Command.withDescription('Sign in to Polar through your browser'),
  Command.withExamples([
    {
      command: 'polar auth login',
      description: 'Choose sandbox or production, then sign in',
    },
    {
      command: 'polar auth login --sandbox',
      description: 'Sign in to sandbox',
    },
    {
      command: 'polar auth login --production --new-session',
      description: 'Sign in to production again, replacing the saved session',
    },
  ]),
  output({
    result: Login,
    run: ({ newSession, ...flags }) =>
      Effect.gen(function* () {
        const environment = yield* chooseEnvironment(flags, 'log in to')
        const auth = yield* Auth
        const replaced = yield* auth.login(
          environment,
          newSession,
          announceAuthorization(environment),
        )
        const selection = replaced ? yield* selectOrganization : undefined
        return { environment, replaced, selection }
      }),
    render: ({ environment, replaced, selection }: typeof Login.Type) => {
      if (!replaced) {
        const other: PolarEnvironment =
          environment === 'production' ? 'sandbox' : 'production'
        return [
          ui.blank,
          ui.warning(`Already logged in to ${ui.bold(environment)}`),
          ui.step(
            `Run ${ui.command(`${loginCommand(environment)} --new-session`)} to sign in again`,
          ),
          ui.step(
            `Run ${ui.command(loginCommand(other))} to sign in to ${other}`,
          ),
          ui.blank,
        ]
      }
      return [
        ui.success(`Logged in to Polar ${ui.bold(environment)}`),
        ui.blank,
        ...(selection ? selectionLines(selection) : []),
      ]
    },
  }),
)

const whoami = Command.make('whoami', {}).pipe(
  Command.withDescription('Show the active organization'),
  output({
    result: Identity,
    run: () =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const organizations = yield* Organizations
        const environments = yield* auth.environments
        if (yield* auth.override) {
          const items = yield* organizations.listAll
          return {
            source: 'POLAR_ACCESS_TOKEN',
            environments,
            organization: items.length === 1 ? items[0]! : null,
          } satisfies Identity
        }
        const selection =
          environments.length > 0 ? yield* organizations.selected : undefined
        return {
          source: 'session',
          environments,
          organization: selection ? yield* organizations.resolve() : null,
        } satisfies Identity
      }),
    render: ({ source, environments, organization }) => {
      if (source === 'POLAR_ACCESS_TOKEN') {
        return [
          ui.blank,
          ui.keyValue([
            ...(organization
              ? organizationRows(organization)
              : [['Environment', environments[0]!] as const]),
            ['Token', 'POLAR_ACCESS_TOKEN'],
          ]),
          ...(organization
            ? []
            : [
                ui.blank,
                ui.warning('No active organization'),
                ui.step(
                  `Use ${ui.command('--org <id>')} on organization-dependent commands`,
                ),
              ]),
          ui.blank,
        ]
      }
      if (environments.length === 0) return [ui.blank, ...notLoggedIn]
      return [
        ui.blank,
        ...(organization
          ? [ui.keyValue(organizationRows(organization))]
          : [
              ui.warning('No active organization'),
              ui.step(`Run ${ui.command(orgCommand)} to choose one`),
            ]),
        ui.blank,
      ]
    },
  }),
)

const list = Command.make('list', {}).pipe(
  Command.withDescription('List the organizations you have access to'),
  output({
    result: Schema.Array(Listed),
    run: () =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const organizations = yield* Organizations
        const environments = yield* auth.environments
        const override = yield* auth.override
        const selection =
          environments.length > 0 ? yield* organizations.selected : undefined
        const items: Array<typeof Listed.Type> = []
        for (const environment of environments) {
          for (const organization of yield* organizations.list(environment)) {
            items.push({
              ...organization,
              active: isSelected(organization, selection),
            })
          }
        }
        return { override, environments, items } satisfies Listing
      }),
    render: ({ override, environments, items }) => {
      if (environments.length === 0) return [ui.blank, ...notLoggedIn]
      const width = Math.max(0, ...items.map((org) => org.name.length))
      return [
        ui.blank,
        ...environments.flatMap((environment) => {
          const rows = items.filter((item) => item.environment === environment)
          return [
            `  ${ui.bold(`Organizations in ${environment}`)}${override ? ui.dim('  via POLAR_ACCESS_TOKEN') : ''}`,
            ui.blank,
            ...(rows.length === 0
              ? [ui.step('No accessible organizations')]
              : []),
            ...rows.map(
              (org) =>
                `  ${org.active ? ui.green('●') : ui.dim('○')} ${org.name.padEnd(width)}  ${ui.dim(org.slug)}  ${ui.dim(org.id)}`,
            ),
            ui.blank,
          ]
        }),
      ]
    },
    json: ({ items }) => items,
  }),
)

const org = Command.make('org', {}).pipe(
  Command.withDescription('Choose the active organization'),
  output({
    result: Selection,
    run: () =>
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
        return yield* selectOrganization
      }),
    render: selectionLines,
  }),
)

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
    const auth = yield* Auth
    const sessions = yield* auth.environments
    if (sessions.length <= 1) return sessions
    if (!(yield* interactive)) {
      return yield* new AuthError({
        message:
          'Pass --sandbox, --production or --all to log out outside an interactive terminal.',
      })
    }
    const choices = sessions.map((environment) => ({
      title: environment === 'production' ? 'Production' : 'Sandbox',
      value: [environment] as PolarEnvironment[],
    }))
    if (sessions.length > 1) {
      choices.push({ title: 'All sessions', value: [...sessions] })
    }
    return yield* Prompt.Select({
      message: 'Which session do you want to log out of?',
      choices,
    })
  })

const logout = Command.make('logout', {
  ...environmentFlags,
  all: Flag.Boolean('all').pipe(
    Flag.withDefault(false),
    Flag.withDescription('Remove every saved session'),
  ),
}).pipe(
  Command.withDescription('Sign out and remove saved sessions'),
  Command.withExamples([
    {
      command: 'polar auth logout',
      description: 'Sign out, asking which session only if you have both',
    },
    {
      command: 'polar auth logout --all',
      description: 'Remove every saved session',
    },
  ]),
  output({
    result: Logout,
    run: (flags) =>
      Effect.gen(function* () {
        const auth = yield* Auth
        const overrideActive = yield* auth.override
        const targets = yield* logoutTargets(flags)
        const deleted = yield* auth.logout(targets)
        return { overrideActive, targets, deleted }
      }),
    render: ({ overrideActive, targets, deleted }: typeof Logout.Type) => [
      ui.blank,
      ...(overrideActive
        ? [
            ui.warning('POLAR_ACCESS_TOKEN remains active'),
            ui.step(
              'Unset it to stop using the override, only saved sessions are removed',
            ),
          ]
        : []),
      ...targets.map((environment) =>
        deleted.includes(environment)
          ? ui.success(`Logged out of Polar ${ui.bold(environment)}`)
          : ui.step(`Already logged out of ${environment}`),
      ),
      ...(targets.length === 0 ? [ui.step('Already logged out')] : []),
      ui.blank,
    ],
  }),
)

export const auth = Command.make('auth').pipe(
  Command.withDescription('Manage your Polar sessions and active organization'),
  Command.withSubcommands([login, whoami, list, org, logout]),
)
