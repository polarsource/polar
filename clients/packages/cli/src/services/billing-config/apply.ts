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
  requiredScopes,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { issues } from '@/services/billing-config/issues'

export interface ApplyOptions {
  /** Name of the catalog version this apply publishes, if it publishes one */
  readonly name?: string | undefined
}

export const apply =
  (clients: Clients) =>
  (
    config: LoadedConfig,
    organization: ActiveOrganization,
    { name }: ApplyOptions = {},
  ) =>
    Effect.gen(function* () {
      const response = yield* post(
        clients,
        '/config/apply',
        config,
        organization,
        name === undefined ? undefined : { catalog_name: name },
      )
      if (response.status === 200) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(ApplyResponse)(response)
        return {
          status: 'applied',
          entries: entries(body.changes, body.settings),
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
      return yield* unexpected(
        response,
        organization,
        requiredScopes(config, 'write'),
      )
    }).pipe(Effect.scoped, Effect.catchTags(transportErrors))
