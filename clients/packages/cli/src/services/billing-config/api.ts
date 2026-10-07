import { Effect } from 'effect'
import {
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/http'
import type { ActiveOrganization, PolarEnvironment } from '@/schemas/Auth'
import {
  ApiError,
  type AppliedEntry,
  BillingConfigError,
  type EntryResult,
  type LoadedConfig,
} from '@/schemas/BillingConfig'
import { apiUrl, describeApiFailure, withOrganization } from '@/services/api'
import type { ApiClient } from '@/services/client'

export type Clients = Record<PolarEnvironment, ApiClient>

export const post = (
  clients: Clients,
  path: string,
  config: LoadedConfig,
  organization: ActiveOrganization,
) =>
  Effect.gen(function* () {
    const request = yield* HttpClientRequest.post(
      yield* apiUrl(organization.environment, path),
    ).pipe(
      withOrganization(organization.id),
      HttpClientRequest.bodyJson(config.input),
    )
    return yield* clients[organization.environment].execute(request)
  })

export const errorName = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(ApiError)(response).pipe(
    Effect.map(({ error }) => error),
    Effect.orElseSucceed(() => undefined),
  )

export const entries = (
  section: string,
  results: ReadonlyArray<typeof EntryResult.Type>,
) =>
  results.map(
    (entry): AppliedEntry => ({
      section,
      id: entry.external_id ?? section,
      action: entry.action,
      diff: entry.diff ?? [],
    }),
  )

export const unexpected = (
  response: HttpClientResponse.HttpClientResponse,
  organization: ActiveOrganization,
  scope: string,
) =>
  Effect.gen(function* () {
    const error = yield* errorName(response)
    if (response.status === 409) {
      return yield* new BillingConfigError({
        message: 'Another request changed this config at the same time',
        hint: 'Run the command again.',
      })
    }
    if (response.status === 403 && error === 'ConfigAsCodeNotEnabled') {
      return yield* new BillingConfigError({
        message: `Config is not enabled for ${organization.name}`,
        hint: 'Ask Polar to enable it for your organization.',
      })
    }
    if (response.status === 403) {
      return yield* new BillingConfigError({
        message: `You do not have access to ${organization.name}`,
        hint: `The token needs the ${scope} scope.`,
      })
    }
    if (response.status === 404) {
      return yield* new BillingConfigError({
        message: `Config commands are not available in ${organization.environment} yet`,
        hint: 'The API is still rolling out. Try again later.',
      })
    }
    const { message, hint } = describeApiFailure(
      response.status,
      organization.environment,
    )
    return yield* new BillingConfigError({ message, hint })
  })

export const transportErrors = {
  HttpClientError: (error: HttpClientError.HttpClientError) =>
    new BillingConfigError({
      message: 'Could not reach the Polar API',
      hint: error.message,
    }),
  HttpBodyError: () =>
    new BillingConfigError({ message: 'Could not encode the config' }),
  SchemaError: () =>
    new BillingConfigError({ message: 'Unexpected response from the API' }),
}
