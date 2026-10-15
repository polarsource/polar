import { Effect, Schema } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { apiUrl, withOrganization } from '@/services/api'
import {
  type Clients,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'

const WebhookEndpoint = Schema.Struct({ secret: Schema.String })

export const webhookSecret =
  (clients: Clients) => (organization: ActiveOrganization, key: string) =>
    Effect.gen(function* () {
      const response = yield* clients[organization.environment].execute(
        HttpClientRequest.get(
          yield* apiUrl(
            organization.environment,
            `/webhooks/endpoints/external/${encodeURIComponent(key)}`,
          ),
        ).pipe(
          withOrganization(organization.id),
          HttpClientRequest.setHeader('Polar-Version', '2027-01'),
        ),
      )
      if (response.status === 404) {
        return yield* new BillingConfigError({
          message: `${organization.name} has no webhook endpoint ${key}`,
          hint: "Use the endpoint's key in the webhooks section, after polar config apply.",
        })
      }
      if (response.status !== 200) {
        return yield* unexpected(response, organization, ['webhooks:read'])
      }
      const { secret } =
        yield* HttpClientResponse.schemaBodyJson(WebhookEndpoint)(response)
      return secret
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: transportErrors.HttpClientError,
        SchemaError: transportErrors.SchemaError,
      }),
    )
