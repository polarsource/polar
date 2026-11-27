import { Effect } from 'effect'
import { HttpClientRequest } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { apiUrl, withOrganization } from '@/services/api'
import {
  type Clients,
  errorName,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'

export const disable =
  (clients: Clients) => (organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const request = yield* HttpClientRequest.post(
        yield* apiUrl(organization.environment, '/config/disable'),
      ).pipe(withOrganization(organization.id), HttpClientRequest.bodyJson({}))
      const response = yield* clients[organization.environment].execute(request)
      if (response.status === 204) return
      if (
        response.status === 409 &&
        (yield* errorName(response)) === 'ConfigCatalogPublished'
      ) {
        return yield* new BillingConfigError({
          message: `Config cannot be disabled for ${organization.name}`,
          hint: 'More than one catalog was published with config, so it stays managed by config.',
        })
      }
      return yield* unexpected(response, organization, ['organizations:write'])
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: transportErrors.HttpClientError,
        HttpBodyError: transportErrors.HttpBodyError,
      }),
    )
