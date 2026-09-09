import { Context, Effect, Layer } from 'effect'
import {
  AuthError,
  orgCommand,
  type ActiveOrganization,
  type PolarEnvironment,
} from '../schemas/Auth'
import { Auth } from './auth'
import { CLIConfig } from './config'
import { Polar } from './polar'

export class Organizations extends Context.Service<
  Organizations,
  {
    selected: (
      environment: PolarEnvironment,
    ) => Effect.Effect<string | undefined, AuthError>
    select: (
      environment: PolarEnvironment,
      id: string,
    ) => Effect.Effect<void, AuthError>
    list: (
      environment: PolarEnvironment,
    ) => Effect.Effect<ActiveOrganization[], AuthError>
    resolve: (
      environment: PolarEnvironment,
      id?: string,
    ) => Effect.Effect<ActiveOrganization, AuthError>
  }
>()('Organizations') {}

export const layer = Layer.effect(
  Organizations,
  Effect.gen(function* () {
    const polar = yield* Polar
    const auth = yield* Auth
    const config = yield* CLIConfig
    const list = (environment: PolarEnvironment) =>
      Effect.gen(function* () {
        const organizations: ActiveOrganization[] = []
        let page = 1
        while (true) {
          const response = yield* polar.use(
            (client) => client.organizations.list({ page, limit: 100 }),
            environment,
          )
          organizations.push(
            ...response.items.map(({ id, name, slug }) => ({
              id,
              name,
              slug,
            })),
          )
          if (page >= response.pagination.max_page) break
          page++
        }
        return organizations
      })
    return Organizations.of({
      list,
      selected: (environment) =>
        Effect.gen(function* () {
          if (yield* auth.override) return undefined
          return yield* config.getActiveOrganization(environment)
        }),
      select: (environment, id) =>
        Effect.gen(function* () {
          if (yield* auth.override)
            return yield* new AuthError({
              message: 'Unset POLAR_ACCESS_TOKEN to manage saved sessions.',
            })
          yield* auth.resolve(environment)
          yield* config.setActiveOrganization(environment, id)
        }),
      resolve: (environment, id) =>
        Effect.gen(function* () {
          const credential = yield* auth.resolve(environment)
          const selected =
            id ??
            (credential.source === 'keyring'
              ? yield* config.getActiveOrganization(environment)
              : undefined)
          if (selected) {
            const organization = yield* polar.use(
              (client) => client.organizations.get(selected),
              environment,
            )
            return {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
            }
          }
          if (credential.source === 'override') {
            const organizations = yield* list(environment)
            if (organizations.length === 1) return organizations[0]!
            return yield* new AuthError({
              message:
                'POLAR_ACCESS_TOKEN has no unique active organization. Supply --org <id> for an accessible organization.',
            })
          }
          return yield* new AuthError({
            message: `No active organization for ${environment}. Run ${orgCommand(environment)} or supply --org <id>.`,
          })
        }),
    })
  }),
)
