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
  type CatalogOptions,
  type Clients,
  entries,
  errorName,
  post,
  requiredScopes,
  transportErrors,
  unexpected,
  withDefaultCurrency,
} from '@/services/billing-config/api'
import { issues } from '@/services/billing-config/issues'

export const apply =
  (clients: Clients) =>
  (
    config: LoadedConfig,
    organization: ActiveOrganization,
    options: CatalogOptions = {},
  ) =>
    Effect.gen(function* () {
      const response = yield* post(
        clients,
        '/config/apply?publish=false',
        config,
        organization,
        options,
      )
      if (response.status === 200) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(ApplyResponse)(response)
        return {
          status: 'applied',
          entries: yield* withDefaultCurrency(
            clients,
            organization,
            entries(body.changes, body.settings, body.removed),
          ),
          ...(body.catalog && { draft: body.catalog.after }),
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
