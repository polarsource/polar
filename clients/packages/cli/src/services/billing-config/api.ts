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
  type SettingsResult,
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

// The server reports settings changes by dotted path, like `payments.currency`
const settingsEntries = (
  settings: typeof SettingsResult.Type | null | undefined,
): AppliedEntry[] => {
  if (!settings) return []
  const groups = new Map<string, AppliedEntry['diff'][number][]>()
  for (const change of settings.diff ?? []) {
    const [group = '', ...field] = change.field.split('.')
    groups.set(group, [
      ...(groups.get(group) ?? []),
      { ...change, field: field.join('.') },
    ])
  }
  if (groups.size === 0) {
    return [
      {
        section: 'settings',
        id: 'settings',
        action: settings.action,
        diff: [],
      },
    ]
  }
  return [...groups].map(([id, diff]) => ({
    section: 'settings',
    id,
    action: 'updated',
    diff,
  }))
}

export const entries = (
  results: ReadonlyArray<typeof EntryResult.Type>,
  settings?: typeof SettingsResult.Type | null,
) => [
  ...settingsEntries(settings),
  ...results.map(
    (entry): AppliedEntry => ({
      section: `${entry.resource}s`,
      id: entry.external_id,
      action: entry.action,
      diff: entry.diff ?? [],
    }),
  ),
]

const requiredScopes = (response: HttpClientResponse.HttpClientResponse) =>
  (
    /scope="([^"]*)"/.exec(response.headers['www-authenticate'] ?? '')?.[1] ??
    ''
  )
    .split(' ')
    .filter((scope) => scope !== '')
    .sort()

export const unexpected = (
  response: HttpClientResponse.HttpClientResponse,
  organization: ActiveOrganization,
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
      const scopes = requiredScopes(response)
      return yield* new BillingConfigError({
        message: `You do not have access to ${organization.name}`,
        hint:
          scopes.length > 0
            ? `The token needs the ${scopes.join(', ')} ${scopes.length > 1 ? 'scopes' : 'scope'}.`
            : "Check the token's organization and permissions.",
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
