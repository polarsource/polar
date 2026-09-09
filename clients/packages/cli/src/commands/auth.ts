import { Console, Effect } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import {
  AuthError,
  loginCommand,
  orgCommand,
  type PolarEnvironment,
} from '../schemas/Auth'
import { Auth } from '../services/auth'
import { Organizations } from '../services/organizations'
import * as ui from '../ui'
import { environmentOf, production } from './flags'

const dashboardUrl = (environment: PolarEnvironment) =>
  `https://${environment === 'sandbox' ? 'sandbox.' : ''}polar.sh`

const selectOrganization = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const organizations = yield* Organizations
    const items = yield* organizations.list(environment)
    if (items.length === 0) {
      yield* Console.log(ui.warning(`No organizations in ${environment} yet`))
      yield* Console.log(
        ui.step(
          `Create one at ${ui.cyan(dashboardUrl(environment))}, then run ${ui.command(orgCommand(environment))}`,
        ),
      )
      yield* Console.log(ui.blank)
      return
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      yield* Console.log(
        ui.warning('Organization selection requires an interactive terminal'),
      )
      yield* Console.log(
        ui.step(
          `Run ${ui.command(orgCommand(environment))} interactively, or use POLAR_ACCESS_TOKEN with ${ui.command('--org <id>')} in CI`,
        ),
      )
      yield* Console.log(ui.blank)
      return
    }
    const activeOrganizationId = yield* organizations.selected(environment)
    const organization = yield* Prompt.select({
      message: `Select ${environment} organization`,
      choices: items.map((organization) => ({
        value: organization,
        title:
          organization.id === activeOrganizationId
            ? `${organization.name} ${ui.dim('(active)')}`
            : organization.name,
        description: organization.slug,
      })),
    })
    yield* organizations.select(environment, organization.id)
    yield* Console.log(ui.blank)
    yield* Console.log(
      ui.success(
        `Active organization ${ui.bold(organization.name)} ${ui.dim(organization.slug)}`,
      ),
    )
    yield* Console.log(ui.blank)
  })

const login = Command.make(
  'login',
  {
    production,
    newSession: Flag.boolean('new-session').pipe(
      Flag.withDefault(false),
      Flag.withDescription('Sign in again even if a session is already saved'),
    ),
  },
  ({ production, newSession }) =>
    Effect.gen(function* () {
      const environment = environmentOf(production)
      const auth = yield* Auth
      const replaced = yield* auth.login(environment, newSession)
      if (!replaced) {
        const other: PolarEnvironment = production ? 'sandbox' : 'production'
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
      yield* selectOrganization(environment)
    }),
).pipe(Command.withDescription('Sign in to Polar through your browser'))

const whoami = Command.make('whoami', { production }, ({ production }) =>
  Effect.gen(function* () {
    const environment = environmentOf(production)
    const auth = yield* Auth
    const organizations = yield* Organizations
    const credential = yield* auth.resolve(environment)
    const rows: Array<readonly [string, string]> = [
      ['Environment', environment],
    ]
    if (credential.source === 'override') {
      rows.push(['Token', 'POLAR_ACCESS_TOKEN'])
      const items = yield* organizations.list(environment)
      if (items.length === 1) {
        const org = items[0]!
        rows.push(['Organization', `${ui.bold(org.name)} ${ui.dim(org.slug)}`])
        rows.push(['ID', ui.dim(org.id)])
      }
    } else if (yield* organizations.selected(environment)) {
      const org = yield* organizations.resolve(environment)
      rows.push(['Organization', `${ui.bold(org.name)} ${ui.dim(org.slug)}`])
      rows.push(['ID', ui.dim(org.id)])
    }
    yield* Console.log(ui.blank)
    yield* Console.log(ui.keyValue(rows))
    if (
      rows.length === 1 ||
      (rows.length === 2 && credential.source === 'override')
    ) {
      yield* Console.log(ui.blank)
      yield* Console.log(ui.warning('No active organization'))
      yield* Console.log(
        ui.step(
          credential.source === 'override'
            ? `Use ${ui.command('--org <id>')} on organization-dependent commands`
            : `Run ${ui.command(orgCommand(environment))} to choose one`,
        ),
      )
    }
    yield* Console.log(ui.blank)
  }),
).pipe(Command.withDescription('Show the active environment and organization'))

const list = Command.make('list', { production }, ({ production }) =>
  Effect.gen(function* () {
    const environment = environmentOf(production)
    const auth = yield* Auth
    const organizations = yield* Organizations
    const credential = yield* auth.resolve(environment)
    const items = yield* organizations.list(environment)
    const activeOrganizationId = yield* organizations.selected(environment)
    yield* Console.log(ui.blank)
    yield* Console.log(
      `  ${ui.bold(`Organizations in ${environment}`)}${credential.source === 'override' ? ui.dim('  via POLAR_ACCESS_TOKEN') : ''}`,
    )
    yield* Console.log(ui.blank)
    if (items.length === 0) {
      yield* Console.log(ui.step('No accessible organizations'))
    }
    const width = Math.max(0, ...items.map((org) => org.name.length))
    for (const org of items) {
      const marker =
        org.id === activeOrganizationId ? ui.green('●') : ui.dim('○')
      yield* Console.log(
        `  ${marker} ${org.name.padEnd(width)}  ${ui.dim(org.slug)}  ${ui.dim(org.id)}`,
      )
    }
    yield* Console.log(ui.blank)
  }),
).pipe(Command.withDescription('List the organizations you have access to'))

const org = Command.make('org', { production }, ({ production }) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    if (yield* auth.override) {
      return yield* new AuthError({
        message: 'Unset POLAR_ACCESS_TOKEN to manage saved sessions.',
      })
    }
    yield* auth.resolve(environmentOf(production))
    yield* selectOrganization(environmentOf(production))
  }),
).pipe(Command.withDescription('Choose the active organization'))

const logout = Command.make('logout', { production }, ({ production }) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const environment = environmentOf(production)
    yield* Console.log(ui.blank)
    if (yield* auth.override) {
      yield* Console.log(ui.warning('POLAR_ACCESS_TOKEN remains active'))
      yield* Console.log(
        ui.step(
          'Unset it to stop using the override, only the saved session is removed',
        ),
      )
    }
    const deleted = yield* auth.logout(environment)
    yield* Console.log(
      deleted
        ? ui.success(`Logged out of Polar ${ui.bold(environment)}`)
        : ui.step(`Already logged out of ${environment}`),
    )
    yield* Console.log(ui.blank)
  }),
).pipe(Command.withDescription('Sign out and remove the saved session'))

export const auth = Command.make('auth').pipe(
  Command.withDescription('Manage your Polar sessions and active organization'),
  Command.withSubcommands([login, whoami, list, org, logout]),
)
