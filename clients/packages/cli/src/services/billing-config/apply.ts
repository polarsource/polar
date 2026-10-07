import { Effect } from 'effect'
import { HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  type ApplyResult,
  ApplyResponse,
  type LoadedConfig,
  ValidationErrors,
} from '@/schemas/BillingConfig'
import {
  type Clients,
  entries,
  errorName,
  post,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { issues } from '@/services/billing-config/issues'

export const apply =
  (clients: Clients) =>
  (config: LoadedConfig, organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const response = yield* post(
        clients,
        '/config/apply',
        config,
        organization,
      )
      if (response.status === 200) {
        const sections =
          yield* HttpClientResponse.schemaBodyJson(ApplyResponse)(response)
        return {
          status: 'applied',
          entries: Object.entries(sections).flatMap(([section, result]) =>
            entries(section, Array.isArray(result) ? result : [result]),
          ),
        } satisfies ApplyResult
      }
      const invalid =
        response.status === 422 ||
        (response.status === 409 &&
          (yield* errorName(response)) === 'ConfigInvalid')
      if (invalid) {
        const { detail } =
          yield* HttpClientResponse.schemaBodyJson(ValidationErrors)(response)
        return {
          status: 'rejected',
          issues: issues(config, detail),
        } satisfies ApplyResult
      }
      return yield* unexpected(response, organization, 'meters:write')
    }).pipe(Effect.scoped, Effect.catchTags(transportErrors))
