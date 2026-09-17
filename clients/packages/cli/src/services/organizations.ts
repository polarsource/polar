import { Context, Effect, Layer } from 'effect'
import {
  AuthError,
  orgCommand,
  type ActiveOrganization,
  type OrganizationSelection,
  type PolarEnvironment,
} from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { CLIConfig } from '@/services/config'
import { Polar } from '@/services/polar'

export class Organizations extends Context.Service<
  Organizations,
  {
    list: (
      environment: PolarEnvironment,
    ) => Effect.Effect<ActiveOrganization[], AuthError>
    listAll: Effect.Effect<ActiveOrganization[], AuthError>
    selected: Effect.Effect<OrganizationSelection | undefined, AuthError>
    select: (selection: OrganizationSelection) => Effect.Effect<void, AuthError>
    resolve: (id?: string) => Effect.Effect<ActiveOrganization, AuthError>
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
              environment,
            })),
          )
          if (page >= response.pagination.max_page) break
          page++
        }
        return organizations
      })
    const listAll = Effect.gen(function* () {
      const organizations: ActiveOrganization[] = []
      for (const environment of yield* auth.environments) {
        organizations.push(...(yield* list(environment)))
      }
      return organizations
    })
    const get = (id: string, environment: PolarEnvironment) =>
      Effect.map(
        polar.use((client) => client.organizations.get(id), environment),
        (organization) => ({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          environment,
        }),
      )
    const find = (id: string) =>
      Effect.gen(function* () {
        const available = yield* auth.environments
        if (available.length === 0) {
          return yield* new AuthError({
            message: 'Not logged in. Run polar auth login.',
          })
        }
        if (available.length === 1) return yield* get(id, available[0]!)
        for (const environment of available) {
          const found = yield* get(id, environment).pipe(
            Effect.catch(() => Effect.succeed(undefined)),
          )
          if (found) return found
        }
        return yield* new AuthError({
          message: `Organization ${id} is missing or inaccessible in ${available.join(' and ')}. Check --org or run polar auth list.`,
        })
      })
    return Organizations.of({
      list,
      listAll,
      selected: Effect.gen(function* () {
        if (yield* auth.override) return undefined
        return yield* config.getActiveOrganization
      }),
      select: (selection) =>
        Effect.gen(function* () {
          if (yield* auth.override)
            return yield* new AuthError({
              message: 'Unset POLAR_ACCESS_TOKEN to manage saved sessions.',
            })
          yield* auth.resolve(selection.environment)
          yield* config.setActiveOrganization(selection)
        }),
      resolve: (id) =>
        Effect.gen(function* () {
          if (id) return yield* find(id)
          if (yield* auth.override) {
            const organizations = yield* listAll
            if (organizations.length === 1) return organizations[0]!
            return yield* new AuthError({
              message:
                'POLAR_ACCESS_TOKEN has no unique active organization. Supply --org <id> for an accessible organization.',
            })
          }
          const selection = yield* config.getActiveOrganization
          if (!selection) {
            return yield* new AuthError({
              message: `No active organization. Run ${orgCommand} or supply --org <id>.`,
            })
          }
          return yield* get(selection.id, selection.environment)
        }),
    })
  }),
)
