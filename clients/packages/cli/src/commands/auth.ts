import { Console, Effect } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import { AuthError, orgCommand, type PolarEnvironment } from '../schemas/Auth'
import { Auth } from '../services/auth'
import { Organizations } from '../services/organizations'
import { environmentOf, production } from './flags'

const selectOrganization = (environment: PolarEnvironment) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const organizations = yield* Organizations
    const items = yield* organizations.list(environment)
    if (items.length === 0) {
      yield* Console.log(
        `No organizations available. Create one at https://${environment === 'sandbox' ? 'sandbox.' : ''}polar.sh, then run ${orgCommand(environment)}.`,
      )
      return
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      yield* Console.log(
        `Organization selection requires an interactive terminal. Run ${orgCommand(environment)} interactively; for CI use POLAR_ACCESS_TOKEN and --org <id>.`,
      )
      return
    }
    const credential = yield* auth.resolve(environment)
    const activeOrganizationId = credential.session?.organization?.id
    const organization = yield* Prompt.select({
      message: `Select ${environment} organization`,
      choices: items.map((organization) => ({
        value: organization,
        title:
          organization.id === activeOrganizationId
            ? `${organization.name} (active)`
            : organization.name,
      })),
    })
    yield* auth.select(environment, organization)
    yield* Console.log(
      `Active organization: ${organization.name} (${organization.slug}) — ${organization.id}`,
    )
  })

const login = Command.make(
  'login',
  {
    production,
    newSession: Flag.boolean('new-session').pipe(Flag.withDefault(false)),
  },
  ({ production, newSession }) =>
    Effect.gen(function* () {
      const environment = environmentOf(production)
      const auth = yield* Auth
      const replaced = yield* auth.login(environment, newSession)
      if (!replaced) {
        yield* Console.log(
          `Already logged in to ${environment}. Use --new-session to log in again.`,
        )
        return
      }
      yield* Console.log(`Logged in to ${environment}.`)
      yield* selectOrganization(environment)
    }),
)

const whoami = Command.make('whoami', { production }, ({ production }) =>
  Effect.gen(function* () {
    const environment = environmentOf(production)
    const auth = yield* Auth
    const organizations = yield* Organizations
    const credential = yield* auth.resolve(environment)
    yield* Console.log(`Environment: ${environment}`)
    if (credential.source === 'override') {
      const items = yield* organizations.list(environment)
      if (items.length !== 1) {
        yield* Console.log(
          'No active organization. Use --org <id> on organization-dependent commands.',
        )
        return
      }
      const org = items[0]!
      yield* Console.log(`Organization: ${org.name} (${org.slug}) — ${org.id}`)
    } else if (credential.session?.organization) {
      const org = yield* organizations.resolve(environment)
      yield* Console.log(`Organization: ${org.name} (${org.slug}) — ${org.id}`)
    } else {
      yield* Console.log(
        `No active organization. Run ${orgCommand(environment)}.`,
      )
    }
  }),
)

const list = Command.make('list', { production }, ({ production }) =>
  Effect.gen(function* () {
    const environment = environmentOf(production)
    const auth = yield* Auth
    const organizations = yield* Organizations
    const credential = yield* auth.resolve(environment)
    const items = yield* organizations.list(environment)
    yield* Console.log(
      `Organizations in ${environment}${credential.source === 'override' ? ' (POLAR_ACCESS_TOKEN override)' : ''}:`,
    )
    if (!items.length) yield* Console.log('No accessible organizations.')
    for (const org of items) {
      yield* Console.log(
        `${org.id === credential.session?.organization?.id ? '*' : ' '} ${org.name} (${org.slug}) — ${org.id}`,
      )
    }
  }),
)

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
)

const logout = Command.make('logout', { production }, ({ production }) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    const environment = environmentOf(production)
    if (yield* auth.override)
      yield* Console.log(
        'POLAR_ACCESS_TOKEN remains active. Unset it to stop using the override; only the saved session will be removed.',
      )
    const deleted = yield* auth.logout(environment)
    yield* Console.log(
      deleted
        ? `Logged out of ${environment}.`
        : `Already logged out of ${environment}.`,
    )
  }),
)

export const auth = Command.make('auth').pipe(
  Command.withSubcommands([login, whoami, list, org, logout]),
)
