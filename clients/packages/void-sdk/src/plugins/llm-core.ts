import {
  classifier,
  count,
  event,
  isMeter,
  meter,
  not,
  on,
  sum,
  usd,
  type ActivityDef,
  type ClassifyOptions,
  type EventDef,
  type Metadata,
  type MeterDef,
  type Price,
  type ReducerDef,
} from '../config/schema'
import type {
  CheckResult,
  EventQuery,
  MeterQuery,
  RecordOptions,
  ScalarQuery,
} from '../runtime/queries'
import type { MeterSnapshot } from '../runtime/snapshot'

/**
 * The client-agnostic half of LLM metering: the completion event, the three
 * billing modes, their schema, verbs and snapshot, and list-price lookup.
 * Nothing here knows how a completion was produced. `llm.ts` adds the Vercel
 * AI SDK on top; another client adapter would import the same core so every
 * completion lands in one event and one set of meters.
 */

export interface Pair<T> {
  readonly input: T
  readonly output: T
}
/** Prices per input and per output token. */
export type TokenPrices = Pair<Price>
export type Tokens = Pair<number>

// ---- the event -------------------------------------------------------------

/** What every completion records. Declared tags come on top. */
// A type alias, not an interface: only aliases satisfy `Metadata`'s index signature.
export type LlmCompletion<Extra extends Metadata = Record<never, never>> = {
  readonly model: string
  readonly provider?: string
  readonly input_tokens: number
  readonly output_tokens: number
  readonly cache_read_tokens?: number
  readonly cache_write_tokens?: number
  readonly reasoning_tokens?: number
  /**
   * Cost of goods in USD: what the gateway charged, or the list price when the
   * gateway did not say and something knows the model's prices. Null when
   * neither is known.
   */
  readonly cost?: number | null
  /** Where `cost` came from: the gateway's name (`gateway`, `openrouter`), `list`, or null. */
  readonly cost_source?: string | null
  /** Credits this completion spent, in the `credits` billing mode. */
  readonly credits?: number
  /** The gateway's id for this generation, for its own lookups (`gateway.getGenerationInfo`). */
  readonly generation_id?: string | null
  /** The provider's own response id. */
  readonly response_id?: string | null
  /**
   * Groups the steps of one `generateText` or `streamText` call. Known on the
   * capture path; the wrapped model sees each provider call on its own.
   */
  readonly call_id?: string | null
  /** Zero-based step within the call, when `call_id` is known. */
  readonly step?: number | null
  /** The first model of the ladder when this call fell back to a cheaper one. */
  readonly fallback_from?: string | null
  readonly finish_reason?: string
  readonly latency_ms?: number
  /** Tool names invoked this step, first-seen order. Names only, no arguments. */
  readonly tools?: readonly string[]
  /** Subset of `tools` that failed or were invalid. */
  readonly tool_errors?: readonly string[]
  /** True when this step produced user-facing text. */
  readonly has_text?: boolean
} & Extra

/** A credit grant: `amount` plus whatever the app wants to remember about it. */
export type Grant = { readonly amount: number; readonly reason?: string }

// ---- billing modes ---------------------------------------------------------

export interface Percent {
  readonly percent: number
}
/** `percent(30)`: a markup of thirty percent. */
export const percent = (value: number): Percent => {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`percent: must be a non-negative number, got ${value}`)
  return { percent: value }
}

/** One entry per named model plus `other` for every model not named. */
export type PerModel<Models extends string, T> = Readonly<Record<Models, T>> & {
  readonly other: T
}

/**
 * Bill tokens per model: an input and an output meter per named model, priced
 * at the configured cost times the markup, and a pair for everything else.
 * Products include token allowances; the unit everywhere is tokens.
 */
export interface PerTokenBilling<Models extends string = string> {
  readonly mode: 'perToken'
  /** Cost prices per token. The markup goes on top. */
  readonly prices: PerModel<Models, TokenPrices>
  readonly markup?: Percent
}
/**
 * Bill what the provider charged times a markup. One `spend` meter whose unit
 * is a dollar of provider cost; `included(ai.spend, 20)` covers twenty
 * dollars of cost a period, the overage bills at the markup factor.
 *
 * No price table is needed when the calls go through a gateway that reports
 * cost and publishes list prices: the cost of each call comes from its
 * response, and the gate's estimate before the call uses its list prices,
 * fetched once and cached. `prices` overrides that for calls that bypass the
 * gateway, or to make the estimate deliberately conservative.
 */
export interface CostPlusBilling<Models extends string = string> {
  readonly mode: 'costPlus'
  readonly markup?: Percent
  /**
   * Optional list prices per model, ahead of the gateway's. A model priced
   * by neither is denied only once its cap is spent and, when it bypassed
   * the gateway, recorded with a null cost.
   */
  readonly prices?: PerModel<Models, TokenPrices>
}
/** Credits per call, per thousand input tokens, and per thousand output tokens. */
export interface CreditRate {
  readonly call: number
  readonly input: number
  readonly output: number
}
/**
 * Bill in credits from a prepaid pool. Each completion is converted with the
 * model's rate and spent from `ai.credits`; plans top the pool up with
 * `included(ai.credits, n)`, purchases with `grant`.
 */
export interface CreditsBilling<Models extends string = string> {
  readonly mode: 'credits'
  readonly rates: PerModel<Models, CreditRate>
  /** Per credit past the allowance. Defaults to zero: prepaid only. */
  readonly price?: Price
  /** Whole credits by default, rounded up. `none` keeps fractions. */
  readonly round?: 'up' | 'none'
}
export type Billing<Models extends string = string> =
  | PerTokenBilling<Models>
  | CostPlusBilling<Models>
  | CreditsBilling<Models>

export const perToken = <Models extends string>(
  prices: PerModel<Models, TokenPrices>,
  options: { readonly markup?: Percent } = {},
): PerTokenBilling<Models> => ({ mode: 'perToken', prices, ...options })

export const costPlus = <Models extends string>(
  options: {
    readonly markup?: Percent
    readonly prices?: PerModel<Models, TokenPrices>
  } = {},
): CostPlusBilling<Models> => ({ mode: 'costPlus', ...options })

export const inCredits = <Models extends string>(options: {
  readonly rates: PerModel<Models, CreditRate>
  readonly price?: Price
  readonly round?: 'up' | 'none'
}): CreditsBilling<Models> => ({ mode: 'credits', ...options })

const rate = (partial: Partial<CreditRate>): CreditRate => {
  const full = { call: 0, input: 0, output: 0, ...partial }
  for (const [name, value] of Object.entries(full))
    if (!Number.isFinite(value) || value < 0)
      throw new Error(
        `rate: ${name} must be a non-negative number, got ${value}`,
      )
  return full
}
/** `perCall(5)`: five credits for every completion, whatever its size. */
export const perCall = (credits: number): CreditRate => rate({ call: credits })
/** `perThousandOutput(3)`: three credits per thousand output tokens. */
export const perThousandOutput = (credits: number): CreditRate =>
  rate({ output: credits })
/** `perThousand({ input: 1, output: 3 })`: credits per thousand tokens of each kind, plus an optional per-call fee. */
export const perThousand = (credits: {
  readonly input?: number
  readonly output?: number
  readonly call?: number
}): CreditRate => rate(credits)

/** Twelve significant digits: enough for any per-token price, free of float noise. */
export const precise = (value: number) => Number(value.toPrecision(12))
const withMarkup = (price: Price, markup: Percent | undefined): Price =>
  markup === undefined
    ? price
    : { ...price, amount: precise(price.amount * (1 + markup.percent / 100)) }
const factor = (markup: Percent | undefined) => 1 + (markup?.percent ?? 0) / 100

export type Unit = 'tokens' | 'usd' | 'credits'

/** The billing mode's verdict on a call before it is made. */
export interface BillingCheck {
  readonly allowed: boolean
  readonly unit: Unit
  /** What the tightest capped holder has left, in `unit`; null when nothing is capped. */
  readonly remaining: number | null
  /** The denying check's reason, else `ok`. */
  readonly reason: CheckResult['reason']
  /** Every meter consulted: `input` and `output` per token, else `spend` or `credits`. */
  readonly results: ReadonlyArray<CheckResult & { readonly meter: string }>
}

// ---- schema, verbs, snapshot by mode ---------------------------------------

type CompletionReducer<Extra extends Metadata> = ReducerDef<
  string,
  EventDef<LlmCompletion<Extra>>,
  { func: 'sum'; property: string }
>
type CompletionMeter<Extra extends Metadata> = MeterDef<
  string,
  CompletionReducer<Extra>
>
type IsPerToken<B> = B extends { readonly mode: 'perToken' } ? true : false
/** Per model: a priced meter pair per token, a plain reducer pair otherwise. */
export type TokenDefs<Extra extends Metadata, B> =
  IsPerToken<B> extends true
    ? Pair<CompletionMeter<Extra>>
    : Pair<CompletionReducer<Extra>>
export type TokenQueries<B> =
  IsPerToken<B> extends true ? Pair<MeterQuery> : Pair<ScalarQuery>

type ModeSchema<Extra extends Metadata, B> = B extends {
  readonly mode: 'costPlus'
}
  ? { readonly spend: CompletionMeter<Extra> }
  : B extends { readonly mode: 'credits' }
    ? {
        readonly credits: CompletionMeter<Extra>
        readonly granted: EventDef<Grant>
      }
    : Record<never, never>
export type LlmSchema<
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
> = {
  readonly completion: EventDef<LlmCompletion<Extra>>
  readonly completions: ReducerDef<
    string,
    EventDef<LlmCompletion<Extra>>,
    { func: 'count' }
  >
  /** Cost of goods: the summed cost of every completion, never priced. */
  readonly cost: CompletionMeter<Extra>
  /** Present when `classify` is on: Polar labels each call's spend after ingest. */
  readonly activity?: ActivityDef
} & {
  readonly [K in Models | 'other' as `${K}/input`]: TokenDefs<Extra, B>['input']
} & {
  readonly [K in Models | 'other' as `${K}/output`]: TokenDefs<
    Extra,
    B
  >['output']
} & ModeSchema<Extra, B>

export interface GrantVerb {
  /** Adds credits to this identity's pool. */
  grant(
    amount: number,
    metadata?: Omit<Grant, 'amount'>,
    options?: RecordOptions,
  ): Promise<void>
}
type ModeVerbs<B> = B extends { readonly mode: 'costPlus' }
  ? { readonly spend: MeterQuery }
  : B extends { readonly mode: 'credits' }
    ? { readonly credits: MeterQuery } & GrantVerb
    : Record<never, never>
/** The core verbs before the mode adds its own. */
export type BaseCoreVerbs<
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
> = {
  /**
   * Records a completion whose counts are already known. The mode adds its
   * own fields; the completion as recorded comes back.
   */
  record(
    completion: LlmCompletion<Extra>,
    options?: RecordOptions,
  ): Promise<LlmCompletion<Extra>>
  /** The billing check for a call of this shape, in the billing unit. */
  check(options: {
    readonly model: string
    readonly inputTokens: number
    readonly maxOutputTokens: number
  }): Promise<BillingCheck>
  /** Cost of goods for this identity. */
  readonly cost: MeterQuery
  readonly completions: ScalarQuery
  /** Token totals per named model: meters per token, plain totals otherwise. */
  readonly models: Readonly<Record<Models, TokenQueries<B>>>
  readonly other: TokenQueries<B>
}
/** The verbs every client adapter shares: record a known completion, check a hypothetical one, read totals. */
export type CoreVerbs<
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
> = BaseCoreVerbs<Models, Extra, B> & ModeVerbs<B>

type ModeSnapshot<Models extends string, B> = B extends {
  readonly mode: 'perToken'
}
  ? {
      readonly models: Readonly<Record<Models, Pair<MeterSnapshot>>>
      readonly other: Pair<MeterSnapshot>
    }
  : B extends { readonly mode: 'costPlus' }
    ? { readonly spend: MeterSnapshot }
    : { readonly credits: MeterSnapshot }
export type LlmSnapshot<Models extends string, B extends Billing<Models>> = {
  readonly cost: MeterSnapshot
} & ModeSnapshot<Models, B>

// ---- helpers ---------------------------------------------------------------

export const OTHER = 'other'

/** Model names carry dots, slashes and colons; slugs may not. */
const slugify = (model: string) =>
  model
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+$/, '')

/** Loose coercions for what providers and catalogues send back. */
export const number = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value !== '' && Number.isFinite(+value))
    return +value
  return null
}
export const string = (value: unknown): string | null =>
  typeof value === 'string' ? value : null
export const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

/** Several meter verdicts as one, in the mode's unit. */
const combine = (
  unit: Unit,
  results: ReadonlyArray<readonly [string, CheckResult]>,
): BillingCheck => {
  const denying = results.find(([, r]) => !r.allowed)
  const capped = results
    .map(([, r]) => r.remaining)
    .filter((v): v is number => v !== null)
  return {
    allowed: denying === undefined,
    unit,
    remaining: capped.length === 0 ? null : Math.min(...capped),
    reason: denying?.[1].reason ?? 'ok',
    results: results.map(([meter, r]) => ({ ...r, meter })),
  }
}

/** The untyped queries a plugin runtime receives. */
export type Loose = {
  readonly events: Readonly<Record<string, EventQuery<EventDef>>>
  readonly reducers: Readonly<Record<string, ScalarQuery>>
  readonly meters: Readonly<Record<string, MeterQuery>>
}

const lookup =
  <T>(table: PerModel<string, T>) =>
  (model: string): T =>
    model in table && model !== OTHER ? table[model]! : table.other

/** What tokens cost at the given list prices. */
export const listCost = (prices: TokenPrices, tokens: Tokens) =>
  precise(
    tokens.input * prices.input.amount + tokens.output * prices.output.amount,
  )

// ---- list prices -----------------------------------------------------------

/** Where a model's list prices come from; null when nothing knows them. */
export type PriceSource = (model: string) => Promise<TokenPrices | null>

const fromTable =
  (table: PerModel<string, TokenPrices>): PriceSource =>
  async (model) =>
    lookup(table)(model)

/**
 * A price table from a catalogue's rows, however the catalogue spells them:
 * rows missing an id or a price are skipped.
 */
export const priceTable = (
  rows: Iterable<{
    readonly id: unknown
    readonly input: unknown
    readonly output: unknown
  }>,
): ReadonlyMap<string, TokenPrices> => {
  const table = new Map<string, TokenPrices>()
  for (const row of rows) {
    const id = string(row.id)
    const input = number(row.input)
    const output = number(row.output)
    if (id === null || input === null || output === null) continue
    table.set(id, { input: usd(input), output: usd(output) })
  }
  return table
}

/** A miss refetches at most this often, so a newly listed model is found without hammering. */
const PRICES_TTL_MS = 60_000
/**
 * The estimate for a model nobody prices: a millionth of a dollar, under any
 * single token's price, so only a cap that is already spent can deny it.
 */
export const UNPRICED_ESTIMATE = 0.000001

/**
 * A price source over a catalogue fetched once and kept for the process. A
 * model the cache does not know triggers one refetch per TTL, shared by
 * every caller that misses meanwhile; a failed fetch is forgotten so the
 * next call tries again, and reads as "unknown" until then.
 */
export const cachedPrices = (
  fetchTable: () => Promise<ReadonlyMap<string, TokenPrices>>,
): PriceSource => {
  type Cache = {
    readonly at: number
    readonly table: Promise<ReadonlyMap<string, TokenPrices>>
  }
  let cache: Cache | null = null
  const load = (): Cache => {
    const loaded: Cache = {
      at: Date.now(),
      table: fetchTable().catch((error: unknown) => {
        if (cache === loaded) cache = null
        throw error
      }),
    }
    cache = loaded
    return loaded
  }
  return async (model) => {
    try {
      const first = cache ?? load()
      const hit = (await first.table).get(model)
      if (hit !== undefined) return hit
      if (Date.now() - first.at < PRICES_TTL_MS) return null
      // Past the TTL: the first miss refetches, concurrent misses share it.
      const fresh = cache === first ? load() : (cache ?? load())
      return (await fresh.table).get(model) ?? null
    } catch {
      return null
    }
  }
}

/** The first source that knows the model wins. */
const firstOf =
  (
    own: PriceSource | undefined,
    fallback: PriceSource | undefined,
  ): PriceSource =>
  async (model) =>
    (await own?.(model)) ?? (await fallback?.(model)) ?? null

/** Fills `cost` from list prices when the gateway did not say. */
const costFromList =
  (priceOf: PriceSource) =>
  async (completion: LlmCompletion): Promise<LlmCompletion> => {
    if (completion.cost !== null && completion.cost !== undefined)
      return completion
    const prices = await priceOf(completion.model)
    if (prices === null) return { ...completion, cost: null, cost_source: null }
    return {
      ...completion,
      cost: listCost(prices, {
        input: completion.input_tokens,
        output: completion.output_tokens,
      }),
      cost_source: 'list',
    }
  }

const creditsFor = (
  rate: CreditRate,
  tokens: Tokens,
  round: 'up' | 'none',
): number => {
  const raw = precise(
    rate.call +
      (tokens.input * rate.input + tokens.output * rate.output) / 1000,
  )
  return round === 'none' ? raw : Math.ceil(raw)
}

// ---- the mode, at runtime --------------------------------------------------

/** What differs between billing modes once the schema is built. */
interface Mode {
  readonly unit: Unit
  /** Adds the mode's own fields to a completion before it is recorded. */
  enrich(completion: LlmCompletion): Promise<LlmCompletion>
  check(queries: Loose, model: string, estimate: Tokens): Promise<BillingCheck>
  verbs(queries: Loose): Record<string, unknown>
  snapshot(
    meters: Readonly<Record<string, MeterSnapshot>>,
  ): Record<string, MeterSnapshot>
}

export interface CoreOptions<Models extends string, B extends Billing<Models>> {
  /** The plugin's name in error messages. */
  readonly plugin: string
  readonly models: readonly Models[]
  readonly billing: B
  /** Slug prefix and event namespace. */
  readonly key: string
  /** List prices the cost-plus gate and cost fall back to after the merchant's own table. */
  readonly listPrices?: PriceSource
  /**
   * Ask Polar to label each call's completions by activity (plan, retrieve,
   * implement, act, review, retry) after ingest. Labels explain spend and
   * never move money. Off by default.
   */
  readonly classify?: ClassifyOptions
}

/** The core built for one plugin: its schema, and the runtime pieces the adapter assembles verbs from. */
export interface Core<
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
> {
  readonly schema: LlmSchema<Models, Extra, B>
  /** The schema's token definitions regrouped by model. */
  readonly models: Readonly<Record<Models, TokenDefs<Extra, B>>>
  readonly other: TokenDefs<Extra, B>
  /** Every meter the schema defines. */
  readonly meters: readonly MeterDef[]
  verbs(queries: Loose): CoreVerbs<Models, Extra, B>
  snapshot(
    meters: Readonly<Record<string, MeterSnapshot>>,
  ): LlmSnapshot<Models, B>
}

/**
 * Validates the options, builds the schema, and picks the billing mode.
 * A client adapter wraps the result in a `plugin(...)` and adds its own verbs.
 */
export const buildCore = <
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
>({
  plugin: name,
  models: names,
  billing,
  key,
  listPrices,
  classify = false,
}: CoreOptions<Models, B>): Core<Models, Extra, B> => {
  if (key === '') throw new Error(`${name}: empty key`)
  if ((names as readonly string[]).includes(OTHER))
    throw new Error(`${name}: ${OTHER} is the catch-all, not a model name`)
  const slugs = new Map<string, string>()
  for (const model of names) {
    const slug = slugify(model)
    if (slug === '') throw new Error(`${name}: model ${model} leaves no slug`)
    const prior = slugs.get(slug)
    if (prior !== undefined)
      throw new Error(
        `${name}: models ${prior} and ${model} share the slug ${slug}`,
      )
    slugs.set(slug, model)
  }
  const table: PerModel<string, unknown> | undefined =
    billing.mode === 'credits' ? billing.rates : billing.prices
  if (table !== undefined) {
    if (!(OTHER in table))
      throw new Error(`${name}: ${billing.mode} needs an entry for ${OTHER}`)
    for (const model of names)
      if (!(model in table))
        throw new Error(
          `${name}: ${billing.mode} has no entry for model ${model}`,
        )
    for (const model of Object.keys(table))
      if (model !== OTHER && !(names as readonly string[]).includes(model))
        throw new Error(
          `${name}: ${billing.mode} prices ${model}, which is not in models`,
        )
  }
  if (
    billing.mode === 'costPlus' &&
    billing.prices === undefined &&
    listPrices === undefined
  )
    throw new Error(
      `${name}: costPlus needs list prices to gate on and to fall back to for cost; pass costPlus({ prices }) or a source of list prices`,
    )

  // Built over the base completion; the user's extra tags are type-only
  // and the schema is widened to them at the end.
  const completion = event<LlmCompletion>(`${key}.completion`)
  type Where = Parameters<typeof on<typeof completion>>[1]
  const whereOf = (model: string): Where =>
    model === OTHER
      ? { model: (names as readonly string[]).map((n) => not(n)) }
      : { model }
  const groups = [...(names as readonly string[]), OTHER].map((model) => ({
    name: model,
    slug: model === OTHER ? OTHER : slugify(model),
    where: whereOf(model),
  }))

  const activity = classifier(key, completion, classify)
  const schema: Record<string, unknown> = {
    completion,
    completions: count(`${key}-completions`, completion),
    cost: meter(`${key}-cost`, {
      reducer: sum(completion, 'cost'),
      price: usd(0),
    }),
    ...(activity !== undefined && { activity }),
  }
  const defs: Record<string, Pair<unknown>> = {}
  const tablePrices =
    billing.mode === 'perToken' ? lookup(billing.prices) : undefined
  for (const { name: model, slug, where } of groups) {
    const source = on(completion, where)
    const prices = tablePrices?.(model)
    const pair: Pair<unknown> =
      billing.mode === 'perToken' && prices
        ? {
            input: meter(`${key}-input-${slug}`, {
              reducer: sum(source, 'input_tokens'),
              price: withMarkup(prices.input, billing.markup),
            }),
            output: meter(`${key}-output-${slug}`, {
              reducer: sum(source, 'output_tokens'),
              price: withMarkup(prices.output, billing.markup),
            }),
          }
        : {
            input: sum(`${key}-input-${slug}`, source, 'input_tokens'),
            output: sum(`${key}-output-${slug}`, source, 'output_tokens'),
          }
    defs[model] = pair
    schema[`${model}/input`] = pair.input
    schema[`${model}/output`] = pair.output
  }

  /** The `name/input` and `name/output` entries of a record, regrouped per model. */
  const pairsFrom = <T>(source: Readonly<Record<string, T>>) => {
    const pairOf = (model: string): Pair<T> => ({
      input: source[`${model}/input`]!,
      output: source[`${model}/output`]!,
    })
    return {
      models: Object.fromEntries(
        (names as readonly string[]).map((n) => [n, pairOf(n)]),
      ),
      other: pairOf(OTHER),
    }
  }

  const mode: Mode = (() => {
    switch (billing.mode) {
      case 'perToken': {
        return {
          unit: 'tokens',
          enrich: costFromList(fromTable(billing.prices)),
          check: async (queries, model, estimate) => {
            const owner = model in billing.prices ? model : OTHER
            const [input, output] = await Promise.all([
              queries.meters[`${owner}/input`]!.check({
                estimate: estimate.input,
              }),
              queries.meters[`${owner}/output`]!.check({
                estimate: estimate.output,
              }),
            ])
            return combine('tokens', [
              ['input', input],
              ['output', output],
            ])
          },
          verbs: () => ({}),
          snapshot: (meters) =>
            pairsFrom(meters) as unknown as Record<string, MeterSnapshot>,
        }
      }
      case 'costPlus': {
        // The merchant's table first, when there is one, then the gateway's.
        const priceOf = firstOf(
          billing.prices && fromTable(billing.prices),
          listPrices,
        )
        schema.spend = meter(`${key}-spend`, {
          reducer: sum(completion, 'cost'),
          price: usd(precise(factor(billing.markup))),
        })
        return {
          unit: 'usd',
          enrich: costFromList(priceOf),
          check: async (queries, model, estimate) => {
            const prices = await priceOf(model)
            return combine('usd', [
              [
                'spend',
                await queries.meters.spend!.check({
                  estimate:
                    prices === null
                      ? UNPRICED_ESTIMATE
                      : listCost(prices, estimate),
                }),
              ],
            ])
          },
          verbs: (queries) => ({ spend: queries.meters.spend! }),
          snapshot: (meters) => ({ spend: meters.spend! }),
        }
      }
      case 'credits': {
        const rateOf = lookup(billing.rates)
        const round = billing.round ?? 'up'
        const granted = event<Grant>(`${key}.granted`)
        schema.granted = granted
        schema.credits = meter(`${key}-credits`, {
          reducer: sum(completion, 'credits'),
          creditReducer: sum(`${key}-granted`, granted, 'amount'),
          price: billing.price ?? usd(0),
        })
        const spent = (model: string, tokens: Tokens) =>
          creditsFor(rateOf(model), tokens, round)
        return {
          unit: 'credits',
          enrich: async (c) => ({
            ...c,
            credits:
              c.credits ??
              spent(c.model, {
                input: c.input_tokens,
                output: c.output_tokens,
              }),
          }),
          check: async (queries, model, estimate) =>
            combine('credits', [
              [
                'credits',
                await queries.meters.credits!.check({
                  estimate: spent(model, estimate),
                }),
              ],
            ]),
          verbs: (queries) => ({
            credits: queries.meters.credits!,
            grant: (
              amount: number,
              metadata: Omit<Grant, 'amount'> = {},
              options?: RecordOptions,
            ) =>
              queries.events.granted!.record({ ...metadata, amount }, options),
          }),
          snapshot: (meters) => ({ credits: meters.credits! }),
        }
      }
    }
  })()

  type Verbs = CoreVerbs<Models, Extra, B>
  type Base = BaseCoreVerbs<Models, Extra, B>
  const verbs = (queries: Loose): Verbs => {
    const record: Base['record'] = async (completion, options) => {
      const enriched = (await mode.enrich(completion)) as LlmCompletion<Extra>
      await queries.events.completion!.record(enriched, options)
      return enriched
    }
    const check: Base['check'] = ({ model, inputTokens, maxOutputTokens }) =>
      mode.check(queries, model, {
        input: inputTokens,
        output: maxOutputTokens,
      })
    return {
      record,
      check,
      cost: queries.meters.cost!,
      completions: queries.reducers.completions!,
      ...pairsFrom(
        billing.mode === 'perToken' ? queries.meters : queries.reducers,
      ),
      ...mode.verbs(queries),
    } as unknown as Verbs
  }

  return {
    schema: schema as unknown as LlmSchema<Models, Extra, B>,
    models: Object.fromEntries(
      (names as readonly string[]).map((n) => [n, defs[n]]),
    ) as Core<Models, Extra, B>['models'],
    other: defs[OTHER] as Core<Models, Extra, B>['other'],
    meters: Object.values(schema).filter(isMeter),
    verbs,
    snapshot: (meters) =>
      ({
        cost: meters.cost!,
        ...mode.snapshot(meters),
      }) as unknown as LlmSnapshot<Models, B>,
  }
}

export type { CheckResult }
