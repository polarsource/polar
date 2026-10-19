import { Context, Effect, Layer } from 'effect'
import { HttpClientResponse } from 'effect/http'
import type { ActiveOrganization, AuthError } from '@/schemas/Auth'
import { BillingConfigError, type LoadedConfig } from '@/schemas/BillingConfig'
import { SimulationResponse } from '@/schemas/Simulation'
import {
  type Clients,
  post,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { authenticatedClient } from '@/services/client'

export class Simulation extends Context.Service<
  Simulation,
  {
    simulate: (
      config: LoadedConfig,
      organization: ActiveOrganization,
    ) => Effect.Effect<SimulationResponse, AuthError | BillingConfigError>
  }
>()('Simulation') {}

export const simulate =
  (clients: Clients) =>
  (config: LoadedConfig, organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const response = yield* post(
        clients,
        '/config/simulate',
        config,
        organization,
      )
      if (response.status === 200) {
        return yield* HttpClientResponse.schemaBodyJson(SimulationResponse)(
          response,
        )
      }
      if (response.status === 422) {
        return yield* new BillingConfigError({
          message: `${config.file} is not a valid config`,
          hint: 'Run polar config plan to see the issues.',
        })
      }
      return yield* unexpected(response, organization, ['subscriptions:read'])
    }).pipe(Effect.scoped, Effect.catchTags(transportErrors))

export const layer = Layer.effect(
  Simulation,
  Effect.gen(function* () {
    const clients = {
      sandbox: yield* authenticatedClient('sandbox'),
      production: yield* authenticatedClient('production'),
      local: yield* authenticatedClient('local'),
    }
    return Simulation.of({ simulate: simulate(clients) })
  }),
)
