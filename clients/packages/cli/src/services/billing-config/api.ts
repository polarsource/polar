import { Effect, Schema } from 'effect'
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
  type Removal,
  type SettingsResult,
} from '@/schemas/BillingConfig'
import { apiUrl, describeApiFailure, withOrganization } from '@/services/api'
import type { ApiClient } from '@/services/client'
import { isSet, record } from '@/utils/billing-config/describe'

export type Clients = Record<PolarEnvironment, ApiClient>

export interface CatalogOptions {
  readonly name?: string | undefined
  readonly catalogId?: string | undefined
}

// Sections the config API doesn't accept yet
const UNSUPPORTED_SECTIONS = new Set([''])

const requestBody = (input: unknown, { name }: CatalogOptions) =>
  typeof input === 'object' && input !== null && !Array.isArray(input)
    ? {
        ...Object.fromEntries(
          Object.entries(input).filter(
            ([section]) => !UNSUPPORTED_SECTIONS.has(section),
          ),
        ),
        ...(name !== undefined && { catalog_name: name }),
      }
    : input

export const post = (
  clients: Clients,
  path: string,
  config: LoadedConfig,
  organization: ActiveOrganization,
  options: CatalogOptions = {},
) =>
  Effect.gen(function* () {
    const request = yield* HttpClientRequest.post(
      yield* apiUrl(organization.environment, path),
    ).pipe(
      withOrganization(organization.id),
      HttpClientRequest.bodyJson(requestBody(config.input, options)),
    )
    return yield* clients[organization.environment].execute(request)
  })

export const errorName = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(ApiError)(response).pipe(
    Effect.map(({ error }) => error),
    Effect.orElseSucceed(() => undefined),
  )

export const SECTIONS = {
  meter: 'meters',
  benefit: 'benefits',
  product: 'products',
  webhook: 'webhooks',
} as const satisfies Record<typeof ConfigResource.Type, string>

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

// A deprecated resource is still listed in `changes`, its removal replaces that entry
export const entries = (
  results: ReadonlyArray<typeof EntryResult.Type>,
  settings?: typeof SettingsResult.Type | null,
  removed: ReadonlyArray<typeof Removal.Type> = [],
) => [
  ...settingsEntries(settings),
  ...results
    .filter(
      (entry) =>
        !removed.some(
          (removal) =>
            removal.resource === entry.resource &&
            removal.external_id === entry.external_id,
        ),
    )
    .map(
      (entry): AppliedEntry => ({
        section: SECTIONS[entry.resource],
        id: entry.external_id,
        action: entry.action,
        diff: entry.diff ?? [],
      }),
    ),
  ...removed.map(
    (removal): AppliedEntry => ({
      section: SECTIONS[removal.resource],
      id: removal.external_id,
      action: 'removed',
      reason: removal.reason,
      diff: [],
    }),
  ),
]

const OrganizationCurrency = Schema.Struct({
  default_presentment_currency: Schema.String,
})

const lacksCurrency = (price: unknown) => {
  const fields = record(price)
  return fields !== undefined && !isSet(fields['price_currency'])
}

const priceChanges = (entry: AppliedEntry) =>
  entry.section === 'products'
    ? entry.diff.filter(({ field }) => field === 'prices')
    : []

const withCurrency = (prices: unknown, currency: string) =>
  Array.isArray(prices)
    ? prices.map((price) =>
        lacksCurrency(price)
          ? { ...record(price), price_currency: currency }
          : price,
      )
    : prices

const organizationCurrency = (
  clients: Clients,
  organization: ActiveOrganization,
) =>
  Effect.gen(function* () {
    const response = yield* clients[organization.environment].get(
      yield* apiUrl(
        organization.environment,
        `/organizations/${organization.id}`,
      ),
    )
    const body =
      yield* HttpClientResponse.schemaBodyJson(OrganizationCurrency)(response)
    return body.default_presentment_currency
  }).pipe(Effect.orElseSucceed(() => undefined))

// A planned price without a currency is shown in the organization's default one
export const withDefaultCurrency = (
  clients: Clients,
  organization: ActiveOrganization,
  planned: ReadonlyArray<AppliedEntry>,
) =>
  Effect.gen(function* () {
    const missing = planned.some((entry) =>
      priceChanges(entry).some(({ before, after }) =>
        [before, after].some(
          (prices) => Array.isArray(prices) && prices.some(lacksCurrency),
        ),
      ),
    )
    if (!missing) return planned
    const currency = yield* organizationCurrency(clients, organization)
    if (currency === undefined) return planned
    return planned.map((entry) =>
      priceChanges(entry).length === 0
        ? entry
        : {
            ...entry,
            diff: entry.diff.map((change) =>
              change.field === 'prices'
                ? {
                    ...change,
                    before: withCurrency(change.before, currency),
                    after: withCurrency(change.after, currency),
                  }
                : change,
            ),
          },
    )
  })

// Settings, benefits, products and webhooks sections need their own scope on top of the meters one
export const requiredScopes = (
  config: LoadedConfig,
  access: 'read' | 'write',
) => {
  const input =
    typeof config.input === 'object' && config.input !== null
      ? config.input
      : {}
  return ['meters', 'benefits', 'products', 'settings', 'webhooks']
    .filter((section) => section === 'meters' || section in input)
    .map(
      (section) =>
        `${section === 'settings' ? 'organizations' : section}:${access}`,
    )
}

export const importCatalogHint = (organization: ActiveOrganization) =>
  `Move your config file aside and run polar config init to import ${organization.name}'s catalog into a new file, then bring your changes over.`

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
        hint: importCatalogHint(organization),
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
