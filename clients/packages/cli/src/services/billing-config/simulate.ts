import { Effect } from 'effect'
import { HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError, type LoadedConfig } from '@/schemas/BillingConfig'
import { SimulationResponse } from '@/schemas/Simulation'
import {
  type Clients,
  post,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'

export type WindowQuery = {
  readonly since?: string | undefined
  readonly until?: string | undefined
}

export const simulate =
  (clients: Clients) =>
  (
    config: LoadedConfig,
    organization: ActiveOrganization,
    window: WindowQuery,
  ) =>
    Effect.gen(function* () {
      const query = new URLSearchParams(
        Object.entries(window).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ).toString()
      const response = yield* post(
        clients,
        `/config/simulate${query && `?${query}`}`,
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
