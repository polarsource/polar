import { Effect } from 'effect'
import { HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  type LoadedConfig,
  type PlanResult,
  PlanResponse,
  ValidationErrors,
} from '@/schemas/BillingConfig'
import {
  type Clients,
  entries,
  post,
  requiredScopes,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { issues } from '@/services/billing-config/issues'

export const plan =
  (clients: Clients) =>
  (config: LoadedConfig, organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const response = yield* post(
        clients,
        '/config/plan',
        config,
        organization,
      )
      if (response.status === 200) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(PlanResponse)(response)
        return {
          entries: entries(body.changes),
          issues: issues(config, body.issues),
        } satisfies PlanResult
      }
      if (response.status === 422) {
        const { detail } =
          yield* HttpClientResponse.schemaBodyJson(ValidationErrors)(response)
        return {
          entries: [],
          issues: issues(config, detail),
        } satisfies PlanResult
      }
      return yield* unexpected(
        response,
        organization,
        requiredScopes(config, 'read'),
      )
    }).pipe(Effect.scoped, Effect.catchTags(transportErrors))
