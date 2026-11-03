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
} from '@/services/billing-config/api'
import { dashboardOrigin } from '@/services/api'
import { issues } from '@/services/billing-config/issues'

export interface ApplyOptions extends CatalogOptions {
  /** `false` saves product and benefit changes as a draft. */
  readonly publish?: boolean | undefined
}

export const apply =
  (clients: Clients) =>
  (
    config: LoadedConfig,
    organization: ActiveOrganization,
    { publish = true, ...options }: ApplyOptions = {},
  ) =>
    Effect.gen(function* () {
      const response = yield* post(
        clients,
        '/config/apply',
        config,
        organization,
        options,
        publish ? {} : { publish: 'false' },
      )
      if (response.status === 200) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(ApplyResponse)(response)
        const draft = publish ? undefined : body.catalog?.after
        return {
          status: 'applied',
          entries: entries(body.changes, body.settings, body.removed),
          ...(draft !== undefined && {
            draft: {
              url: `${yield* dashboardOrigin(organization.environment)}/dashboard/${organization.slug}/products/versions/${draft.id}`,
            },
          }),
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
