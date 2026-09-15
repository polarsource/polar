import {
  gateway as vercel,
  type LanguageModelMiddleware,
  type ProviderMetadata,
  type wrapLanguageModel,
} from 'ai'
import type { Metadata } from '../config/schema'
import { VoidError } from '../errors'
import {
  cachedPrices,
  number,
  object,
  priceTable,
  string,
  type PriceSource,
} from './llm-core'

// Types derived from the `ai` middleware contract, so the SDK never imports
// `@ai-sdk/provider` directly.
type WrapOptions = Parameters<
  NonNullable<LanguageModelMiddleware['wrapGenerate']>
>[0]
/** The params a provider call is made with. */
export type CallOptions = WrapOptions['params']
/** Any model `wrapLanguageModel` accepts. */
export type WrappableModel = Exclude<
  Parameters<typeof wrapLanguageModel>[0]['model'],
  string
>

const MAX_TAGS = 10

/** What a gateway's response says about the call. */
export interface GatewayDetails {
  /** USD, or null when the response carries no cost. */
  readonly cost: number | null
  /** The gateway's id for this generation, for its own lookups. */
  readonly generation_id: string | null
}

/**
 * Everything the AI SDK plugin needs from whoever routes the calls upstream.
 * The plugin meters and gates the same way whatever the gateway; the gateway
 * decides where cost of goods comes from, where list prices come from, how
 * the identity is stamped onto a request, and what a bare model id means.
 * `direct()` is the default and means none of that; `vercelGateway()` and
 * `openrouter()` are the two shipped. Spread one to override a piece:
 * `{ ...vercelGateway(), resolve }`.
 */
export interface Gateway {
  /** Labels `cost_source` on completions this gateway priced. */
  readonly name: string
  /**
   * Whether responses carry the dollar cost of the call. Cost-plus billing
   * needs one that does: without an actual cost there is nothing to bill
   * plus a markup, and `llm` refuses the combination.
   */
  readonly reportsCost: boolean
  /** Cost and generation id from a response, when the call went through this gateway. */
  details(
    metadata: ProviderMetadata | undefined,
    responseId: string | null,
  ): GatewayDetails
  /**
   * List prices in USD per token, for the cost-plus gate and cost fallback;
   * null for a model it does not know. Left out when the gateway has no
   * catalogue, in which case cost-plus billing needs the merchant's `prices`.
   */
  readonly prices?: PriceSource
  /** Stamps the identity and tags onto a request so the gateway's own reporting groups like Void does. */
  tagParams(params: CallOptions, identity: string, tags: Metadata): CallOptions
  /**
   * Turns a bare model id into a model. The adapter has already tried the AI
   * SDK's own default provider; this runs when the app set none.
   */
  resolve(modelId: string): WrappableModel
}

const NO_DETAILS: GatewayDetails = { cost: null, generation_id: null }

/** Tags as `key:value` strings, the shape gateways report on. */
const tagStrings = (tags: Metadata) =>
  Object.entries(tags)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => `${k}:${v}`)

/** Merges into the gateway's own `providerOptions` namespace, keeping what the caller set there. */
const withProviderOptions = (
  params: CallOptions,
  namespace: string,
  patch: (existing: Record<string, unknown>) => Record<string, unknown>,
): CallOptions => {
  const existing = params.providerOptions?.[namespace] ?? {}
  return {
    ...params,
    providerOptions: {
      ...params.providerOptions,
      [namespace]: { ...existing, ...patch(existing) } as never,
    },
  }
}

// ---- No gateway ------------------------------------------------------------

/**
 * Direct providers, the default: nothing sits between the app and the
 * vendor. Responses carry no cost, so cost of goods comes from the billing
 * mode's price table or stays null, and cost-plus billing is refused. No
 * catalogue, nothing stamped on requests, and a bare model id has nothing to
 * resolve through.
 */
export const direct = (): Gateway => DIRECT
const DIRECT: Gateway = {
  name: 'direct',
  reportsCost: false,
  details: () => NO_DETAILS,
  tagParams: (params) => params,
  resolve: (modelId) => {
    throw new VoidError({
      reason: 'invalid_argument',
      message: `llm: cannot resolve '${modelId}' without a gateway; pass a model object such as openai('${modelId}'), or set gateway: vercelGateway() or openrouter({ provider })`,
    })
  },
}

// ---- Vercel AI Gateway -----------------------------------------------------

/** One catalogue per process, however many plugins use the gateway. */
const VERCEL_PRICES = cachedPrices(async () => {
  const { models } = await vercel.getAvailableModels()
  return priceTable(
    models.map((m) => ({
      id: m.id,
      input: m.pricing?.input,
      output: m.pricing?.output,
    })),
  )
})

/**
 * Vercel AI Gateway. Cost and generation id come from
 * `providerMetadata.gateway`, list prices from `gateway.getAvailableModels()`,
 * and a bare model id resolves through the gateway. The identity becomes the
 * request's `user` unless the call set one; tags are merged into its `tags`.
 */
export const vercelGateway = (): Gateway => ({
  name: 'gateway',
  reportsCost: true,
  details: (metadata) => ({
    cost: number(metadata?.gateway?.cost),
    generation_id: string(metadata?.gateway?.generationId),
  }),
  prices: VERCEL_PRICES,
  tagParams: (params, identity, tags) =>
    withProviderOptions(params, 'gateway', (existing) => {
      const theirs = Array.isArray(existing.tags)
        ? existing.tags.filter((t): t is string => typeof t === 'string')
        : []
      return {
        user: string(existing.user) ?? identity,
        tags: [...new Set([...theirs, ...tagStrings(tags)])].slice(0, MAX_TAGS),
      }
    }),
  resolve: (modelId) => vercel.languageModel(modelId),
})

// ---- OpenRouter ------------------------------------------------------------

export interface OpenRouterOptions {
  /**
   * The `@openrouter/ai-sdk-provider` instance bare model ids resolve
   * through, as `createOpenRouter({ apiKey })`. Without one, pass models as
   * objects; a bare id throws.
   */
  readonly provider?: {
    languageModel(modelId: string): WrappableModel
  }
  /** Where the model catalogue is read from. Defaults to OpenRouter's public endpoint. */
  readonly catalogueUrl?: string
  /** For the catalogue fetch. Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch
}

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

/** One catalogue per URL when the global fetch is used; a custom fetch gets its own. */
const openrouterCatalogues = new Map<string, PriceSource>()
const openrouterPrices = (
  url: string,
  fetchImpl: typeof fetch,
): PriceSource => {
  const load = () =>
    cachedPrices(async () => {
      const response = await fetchImpl(url)
      if (!response.ok)
        throw new Error(`openrouter: catalogue responded ${response.status}`)
      const { data } = (await response.json()) as {
        data?: ReadonlyArray<{
          id?: unknown
          pricing?: { prompt?: unknown; completion?: unknown }
        }>
      }
      return priceTable(
        (data ?? []).map((m) => ({
          id: m.id,
          input: m.pricing?.prompt,
          output: m.pricing?.completion,
        })),
      )
    })
  if (fetchImpl !== globalThis.fetch) return load()
  let shared = openrouterCatalogues.get(url)
  if (!shared) openrouterCatalogues.set(url, (shared = load()))
  return shared
}

/**
 * OpenRouter through `@openrouter/ai-sdk-provider`. Every request asks for
 * usage accounting, so cost arrives inline as
 * `providerMetadata.openrouter.usage.cost`; the generation id is the response
 * id, for `GET /api/v1/generation`. List prices come from the public model
 * catalogue. OpenRouter has a `user` field but no tags, so the identity is
 * stamped and the tags stay on the Void event only.
 *
 * OpenRouter's own model routing (`models: [...]` fallbacks) picks the model
 * after the gate ran: the completion still records the model that answered,
 * but the estimate was priced for the one requested.
 */
export const openrouter = (options: OpenRouterOptions = {}): Gateway => {
  const {
    provider,
    catalogueUrl = OPENROUTER_MODELS_URL,
    fetch: fetchImpl = globalThis.fetch,
  } = options
  return {
    name: 'openrouter',
    reportsCost: true,
    details: (metadata, responseId) => ({
      cost: number(object(metadata?.openrouter?.usage)?.cost),
      generation_id: responseId,
    }),
    prices: openrouterPrices(catalogueUrl, fetchImpl),
    tagParams: (params, identity) =>
      withProviderOptions(params, 'openrouter', (existing) => ({
        user: string(existing.user) ?? identity,
        usage: { ...object(existing.usage), include: true },
      })),
    resolve: (modelId) => {
      if (provider === undefined)
        throw new VoidError({
          reason: 'invalid_argument',
          message: `llm: cannot resolve '${modelId}' without a provider; pass openrouter({ provider: createOpenRouter({ apiKey }) }) or a model object`,
        })
      return provider.languageModel(modelId)
    },
  }
}
