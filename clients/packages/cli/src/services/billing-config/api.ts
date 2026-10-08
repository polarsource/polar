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
  type ConfigResource,
  type EntryResult,
  type LoadedConfig,
} from '@/schemas/BillingConfig'
import { apiUrl, describeApiFailure, withOrganization } from '@/services/api'
import type { ApiClient } from '@/services/client'

export type Clients = Record<PolarEnvironment, ApiClient>

// Sections the config API doesn't accept yet
const UNSUPPORTED_SECTIONS = new Set([''])

const stripUnsupported = (input: unknown): unknown =>
  typeof input === 'object' && input !== null && !Array.isArray(input)
    ? Object.fromEntries(
        Object.entries(input).filter(
          ([section]) => !UNSUPPORTED_SECTIONS.has(section),
        ),
      )
    : input

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
      HttpClientRequest.bodyJson(stripUnsupported(config.input)),
    )
    return yield* clients[organization.environment].execute(request)
  })

export const errorName = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(ApiError)(response).pipe(
    Effect.map(({ error }) => error),
    Effect.orElseSucceed(() => undefined),
  )

const SECTIONS = {
  meter: 'meters',
  benefit: 'benefits',
  product: 'products',
} as const satisfies Record<typeof ConfigResource.Type, string>

export const entries = (results: ReadonlyArray<typeof EntryResult.Type>) =>
  results.map(
    (entry): AppliedEntry => ({
      section: SECTIONS[entry.resource],
      id: entry.external_id,
      action: entry.action,
      diff: entry.diff ?? [],
    }),
  )

// Benefits and products sections need their own scope on top of the meters one
export const requiredScopes = (
  config: LoadedConfig,
  access: 'read' | 'write',
) => {
  const input =
    typeof config.input === 'object' && config.input !== null
      ? config.input
      : {}
  return ['meters', 'benefits', 'products']
    .filter((section) => section === 'meters' || section in input)
    .map((section) => `${section}:${access}`)
}

export const unexpected = (
  response: HttpClientResponse.HttpClientResponse,
  organization: ActiveOrganization,
  scopes: ReadonlyArray<string>,
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
        hint: `The token needs the ${scopes.join(', ')} ${scopes.length > 1 ? 'scopes' : 'scope'}.`,
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
