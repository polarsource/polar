import {
  registerTelemetry,
  wrapLanguageModel,
  type LanguageModelMiddleware,
  type LanguageModelUsage,
  type ProviderMetadata,
  type StepResult,
  type Telemetry,
  type ToolSet,
} from 'ai'
import { plugin, type PluginClient, type PluginDef } from '../config/plugin'
import type { Metadata, MeterDef } from '../config/schema'
import { VoidError } from '../errors'
import type { MeterSnapshot } from '../runtime/snapshot'
import {
  buildCore,
  string,
  type Billing,
  type BillingCheck,
  type CoreVerbs,
  type LlmCompletion,
  type LlmSchema,
  type LlmSnapshot,
  type Loose,
  type TokenDefs,
} from './llm-core'
import {
  direct,
  type CallOptions,
  type Gateway,
  type WrappableModel,
} from './llm-gateways'

// Types derived from the `ai` middleware contract, so the SDK never imports
// `@ai-sdk/provider` directly.
type WrapGenerate = NonNullable<LanguageModelMiddleware['wrapGenerate']>
type ProviderModel = Parameters<WrapGenerate>[0]['model']
/** Anything `wrapLanguageModel` accepts, or a model id the gateway resolves. */
export type ModelInput = WrappableModel | string
type GenerateResult = Awaited<ReturnType<WrapGenerate>>
type StreamResult = Awaited<
  ReturnType<NonNullable<LanguageModelMiddleware['wrapStream']>>
>
type StreamPart =
  StreamResult['stream'] extends ReadableStream<infer P> ? P : never
type FinishPart = Extract<StreamPart, { type: 'finish' }>
/** What a finished provider call and a stream's finish part have in common. */
type Finished = Pick<
  GenerateResult,
  'usage' | 'finishReason' | 'providerMetadata'
>
type Step = StepResult<ToolSet>

// ---- options ---------------------------------------------------------------

export type LlmOptions<
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
> = {
  /** The models the merchant prices by name, as `vendor/model` (`anthropic/claude-sonnet-5`). Anything else is `other`. */
  readonly models: readonly Models[]
  /** How the customer is billed: `perToken`, `costPlus`, or `inCredits`. Tracking is the same in every mode. */
  readonly billing: B
  /**
   * Who routes the calls upstream: where cost of goods and list prices come
   * from, how the identity is stamped onto a request, and what a bare model
   * id means. Defaults to `direct()`, meaning nobody: per-token and credits
   * billing work as is, cost-plus and bare model ids need `vercelGateway()`
   * or `openrouter()`.
   */
  readonly gateway?: Gateway
  /**
   * Called once per model that no name in `models` matches, so it bills as
   * `other`. Defaults to a `console.warn`; `false` silences it for merchants
   * who mean `other` to catch a long tail.
   */
  readonly onUnknownModel?: false | ((model: UnknownModel) => void)
  /** Slug prefix and event namespace. Defaults to `llm`. */
  readonly key?: string
  /** Type-only: the user's own tags on every completion, as `tags<{ feature: string }>()`. */
  readonly tags?: Extra
  /**
   * Capture every AI SDK call in the process, not only those through a
   * wrapped model. On by default: `createVoid` hooks the AI SDK's lifecycle
   * for this plugin so each step is recorded as the ambient identity, with
   * the scope's tags as its tags. Pass options to shape it, or `false`
   * to record only through wrapped models.
   */
  readonly capture?: false | CaptureOptions<Extra>
}

/**
 * How a failed check reacts. `block` throws before the provider is called,
 * `warn` logs and proceeds, `off` skips the check. The check runs on an
 * estimate (four characters per input token, `maxOutputTokens` for output)
 * converted to the billing unit; the bill always uses the usage the provider
 * reports.
 */
export type Gate = 'block' | 'warn' | 'off'

export interface Estimate {
  readonly inputTokens: number
  readonly maxOutputTokens: number
}
export interface CallStart {
  readonly model: string
  readonly provider: string
  readonly estimate: Estimate
  readonly params: CallOptions
  /** The billing check against the estimate, or your own numbers. */
  check(override?: Partial<Estimate>): Promise<BillingCheck>
}
export interface CallEnd<Extra extends Metadata> {
  readonly completion: LlmCompletion<Extra>
}
export interface CallDenied {
  readonly model: string
  /** The failed check, or null when `allow` vetoed. */
  readonly check: BillingCheck | null
  readonly by: 'gate' | 'allow'
}
/** A tier the ladder passed over, with the check that ruled it out. */
export interface Skipped {
  readonly model: string
  readonly check: BillingCheck
}
export interface Fallback {
  /** The tier that ran. */
  readonly to: string
  /** Every tier above it, in ladder order, with the check that ruled each out. */
  readonly skipped: readonly Skipped[]
}
export interface FallbackOptions {
  /** Runs when the ladder picks anything but its first model. */
  onFallback?(fallback: Fallback): Promise<void> | void
}

const METERED: unique symbol = Symbol.for('void.metered')
/** What `fallback` needs from a tier: its check on a call, and its headroom. */
interface Tier {
  check(params: CallOptions): Promise<BillingCheck>
  readonly minRemaining: number
}
/** A model from `scope.ai.model`: a provider model that carries its own billing check. */
export interface MeteredModel extends ProviderModel {
  readonly [METERED]: Tier
}

/** Declared tags are required; with none declared the field is optional. */
type Tagged<Extra extends Metadata> =
  Record<never, never> extends Extra
    ? { readonly tags?: Extra }
    : { readonly tags: Extra }
type TagArgs<Extra extends Metadata> =
  Record<never, never> extends Extra ? [tags?: Extra] : [tags: Extra]
export type ModelOptions<Extra extends Metadata> = Tagged<Extra> & {
  /** Defaults to `block`. */
  readonly gate?: Gate
  /** Output estimate when the call sets no `maxOutputTokens`. Defaults to 4096. */
  readonly maxOutputTokens?: number
  /**
   * Inside a `fallback` ladder: skip this model when less than this much
   * remains, in the billing unit, not only when it is denied. Defaults to 0,
   * meaning only when denied. Nothing on its own.
   */
  readonly minRemaining?: number
  /** Runs after the gate. Return false to deny the call; a veto always blocks. */
  allow?(call: CallStart): Promise<boolean | void> | boolean | void
  /** Runs once the completion is recorded. */
  onEnd?(call: CallEnd<Extra>): Promise<void> | void
  /** Runs on every denial, before the gate's own reaction. */
  onDenied?(call: CallDenied): Promise<void> | void
  onError?(error: unknown): void
}
type ModelArgs<Extra extends Metadata> =
  Record<never, never> extends Extra
    ? [options?: ModelOptions<Extra>]
    : [options: ModelOptions<Extra>]

// ---- verbs -----------------------------------------------------------------

/** The verbs only the AI SDK adapter has, on top of the core's. */
export interface SdkVerbs<Extra extends Metadata> {
  /**
   * The same model, metered as this identity. Takes a model or a model id
   * (`'anthropic/claude-sonnet-5'`, resolved by the gateway) and returns a
   * model that drops into `generateText`, `streamText` or an agent
   * unchanged: the gate runs before each provider call and one completion is
   * recorded from the usage it reports. Several of these, most to least
   * preferred, make a ladder with `fallback`.
   */
  model(model: ModelInput, ...args: ModelArgs<Extra>): MeteredModel
  /** A per-call telemetry integration bound to this identity, for `telemetry.integrations`. */
  telemetry(...args: TagArgs<Extra>): Telemetry
}
export type LlmVerbs<
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
> = CoreVerbs<Models, Extra, B> & SdkVerbs<Extra>

/** What capturing needs from a Void client. */
export type TelemetryClient = PluginClient
/** How captured steps become completions. */
export interface CaptureOptions<Extra extends Metadata> {
  /**
   * Tags on every captured completion. Defaults to those of the ambient
   * scope (`scope.run(fn, tags)`, the middleware's `tags`). A function sees
   * the step and the scope's tags and returns the final ones.
   */
  readonly tags?: Extra | ((step: Step, tags: Metadata) => Extra)
  /**
   * Names the identity when no scope is ambient. Defaults to
   * `runtimeContext.voidIdentity`, which the call must include in
   * `telemetry.includeRuntimeContext` to reach integrations.
   */
  identity?(step: Step): string | undefined
  /** Called when a step resolves to no identity. It is dropped. */
  onUnknownIdentity?(step: Step): void
  /** Called when recording a step fails. Defaults to `console.error`; the AI SDK call itself is unaffected. */
  onError?(error: unknown, step: Step): void
}
type CaptureArgs<Extra extends Metadata> =
  Record<never, never> extends Extra
    ? [options?: CaptureOptions<Extra>]
    : [options: CaptureOptions<Extra>]

/** The config-level plugin object, beyond its schema. */
export interface LlmPlugin<
  Models extends string,
  Extra extends Metadata,
  B extends Billing<Models>,
> {
  /** The schema's token definitions regrouped by model, so products read `ai.models[name].output`. */
  readonly models: Readonly<Record<Models, TokenDefs<Extra, B>>>
  readonly other: TokenDefs<Extra, B>
  /**
   * Every meter the plugin defines, for spreading onto a product after the
   * few with terms: `[included(ai.models[m].output, 200_000), ...ai.meters]`
   * bills everything else pay per use without naming each meter.
   */
  readonly meters: readonly MeterDef[]
  /**
   * The capture integration as an AI SDK `Telemetry` object, for callers who
   * register it themselves or pass it per call. `createVoid` already does
   * this for the plugin unless `capture` is `false`. Each finished step is
   * recorded as the ambient identity (`scope.run`, the middleware) or,
   * failing that, as the identity `options.identity` names. Steps already
   * recorded by a wrapped model are skipped, so both can coexist.
   */
  telemetry(client: TelemetryClient, ...args: CaptureArgs<Extra>): Telemetry
}

// ---- helpers ---------------------------------------------------------------

/** Our key in `providerOptions` and `providerMetadata`. */
const VOID = 'void'

/** Four characters per token: an estimate for the gate, never billed. */
export const estimateInputTokens = (prompt: CallOptions['prompt']): number => {
  let chars = 0
  for (const message of prompt) {
    if (typeof message.content === 'string') {
      chars += message.content.length
      continue
    }
    for (const part of message.content) {
      if (part.type === 'text') chars += part.text.length
      else chars += 256
    }
  }
  return Math.max(1, Math.ceil(chars / 4))
}

const fromProviderUsage = (usage: GenerateResult['usage']) => ({
  input_tokens: usage.inputTokens.total ?? 0,
  output_tokens: usage.outputTokens.total ?? 0,
  cache_read_tokens: usage.inputTokens.cacheRead ?? 0,
  cache_write_tokens: usage.inputTokens.cacheWrite ?? 0,
  reasoning_tokens: usage.outputTokens.reasoning ?? 0,
})

const fromSdkUsage = (usage: LanguageModelUsage) => ({
  input_tokens: usage.inputTokens ?? 0,
  output_tokens: usage.outputTokens ?? 0,
  cache_read_tokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
  cache_write_tokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
  reasoning_tokens: usage.outputTokenDetails.reasoningTokens ?? 0,
})

/** Cost and generation id as the gateway reads them, labelled with its name. */
const costDetails = (
  gateway: Gateway,
  metadata: ProviderMetadata | undefined,
  responseId: string | null,
) => {
  const { cost, generation_id } = gateway.details(metadata, responseId)
  return {
    cost,
    cost_source: cost === null ? null : gateway.name,
    generation_id,
  }
}

/** Names a completion's model from what the provider reported. */
export type Canonical = (provider: string, modelId: string) => string

/**
 * One finished step of `generateText` or `streamText` as a completion, with
 * the gateway reading its own cost off the step and `canonical` naming the
 * model. `scope.ai.telemetry()` and capture call this; so can anyone with a
 * step in hand.
 */
export const completionFromStep = <Extra extends Metadata>(
  step: Pick<
    Step,
    | 'callId'
    | 'stepNumber'
    | 'model'
    | 'usage'
    | 'finishReason'
    | 'providerMetadata'
    | 'performance'
    | 'response'
  >,
  extra: Extra,
  gateway: Gateway,
  canonical: Canonical,
): LlmCompletion<Extra> =>
  ({
    ...extra,
    model: canonical(step.model.provider, step.model.modelId),
    provider: step.model.provider,
    ...fromSdkUsage(step.usage),
    ...costDetails(gateway, step.providerMetadata, step.response.id),
    response_id: step.response.id,
    call_id: step.callId,
    step: step.stepNumber,
    fallback_from: null,
    finish_reason: step.finishReason,
    latency_ms: Math.round(step.performance.responseTimeMs),
  }) as LlmCompletion<Extra>

/** A model no name in `models` matched, as the provider reported it and as it was recorded. */
export interface UnknownModel {
  readonly provider: string
  readonly modelId: string
  /** The `vendor/model` name it was recorded under. */
  readonly canonical: string
}

/** Separators a dated or versioned variant appends to a base model name. */
const VARIANT = /[-.:@]/
const tail = (name: string) => name.slice(name.indexOf('/') + 1)

/**
 * The `vendor/model` name a completion records, from what the provider
 * reported. Gateways already say `openai/gpt-5`; a direct provider says
 * `openai.responses` and `gpt-5`, Bedrock says `anthropic.claude-sonnet-5-v1:0`,
 * Azure says whatever the deployment is called. Matched against the merchant's
 * names in order: exact, then a name whose tail is the whole id (Azure
 * deployments named after the model), then a name whose tail the id extends
 * past a separator (dated variants), longest tail first. A tie at any step
 * falls through. Unmatched, the provider-derived name stands and bills as
 * `other`.
 */
export const canonicalModel = (
  names: readonly string[],
  provider: string,
  modelId: string,
): string => {
  if (modelId.includes('/')) return modelId
  const candidates = [`${provider.split('.')[0]!}/${modelId}`]
  if (modelId.includes('.')) candidates.push(modelId.replace('.', '/'))
  for (const candidate of candidates)
    if (names.includes(candidate)) return candidate
  const tails = candidates.map(tail)
  const unique = (matches: readonly string[]) => {
    const [best, next] = [...matches].sort((a, b) => b.length - a.length)
    return best !== undefined && best.length !== next?.length ? best : null
  }
  return (
    unique(names.filter((n) => tails.includes(tail(n)))) ??
    unique(
      names.filter((n) =>
        tails.some(
          (t) =>
            t.startsWith(tail(n)) && VARIANT.test(t.charAt(tail(n).length)),
        ),
      ),
    ) ??
    candidates[0]!
  )
}

/** `canonicalModel` memoised per reported model, telling `onUnknown` once per unmatched one. */
const canonicalizer = (
  names: readonly string[],
  onUnknown: false | ((model: UnknownModel) => void),
): Canonical => {
  const known = new Map<string, string>()
  return (provider, modelId) => {
    const raw = `${provider} ${modelId}`
    let canonical = known.get(raw)
    if (canonical === undefined) {
      canonical = canonicalModel(names, provider, modelId)
      known.set(raw, canonical)
      if (onUnknown !== false && !names.includes(canonical))
        onUnknown({ provider, modelId, canonical })
    }
    return canonical
  }
}

/** A wrapped model marks what it recorded so capture does not record it again. */
const recordedBy = (metadata: ProviderMetadata | undefined) =>
  string(metadata?.[VOID]?.recordedBy)
const markRecorded = (
  metadata: ProviderMetadata | undefined,
  id: string,
): ProviderMetadata => ({ ...metadata, [VOID]: { recordedBy: id } })

/**
 * The ladder tells the tier it picked how the call was routed, through
 * `providerOptions.void`: where it fell back from, and whether the ladder's
 * own check already passed it, so the tier's gate need not run again. The
 * tier's middleware lifts it out before the provider sees the params and
 * keeps it by params identity for the gate and the record.
 */
interface Routed {
  readonly from: string | null
  readonly prechecked: boolean
}
const routed = new WeakMap<CallOptions, Routed>()
const liftRouting = (params: CallOptions): CallOptions => {
  const own = params.providerOptions?.[VOID]
  if (own === undefined) return params
  const { [VOID]: _, ...providerOptions } = params.providerOptions ?? {}
  const lifted = { ...params, providerOptions }
  routed.set(lifted, {
    from: string(own.fallbackFrom),
    prechecked: own.prechecked === true,
  })
  return lifted
}
const withRouting = (params: CallOptions, routing: Routed): CallOptions => ({
  ...params,
  providerOptions: {
    ...params.providerOptions,
    [VOID]: { fallbackFrom: routing.from, prechecked: routing.prechecked },
  },
})

/**
 * One AI SDK registration per plugin key per copy of `ai`, delegating to the
 * most recently attached client. Bundlers such as Next give each route its own
 * copy of `ai` with its own registry, and a hot reload re-creates the plugin;
 * keying on the `registerTelemetry` function and the plugin key makes both
 * cases register exactly once. A disposed client detaches, so nothing records
 * through it afterwards.
 */
interface Registration {
  integration: Telemetry | null
}
const REGISTRY = Symbol.for('void.llm.telemetry')
const registration = (key: string): Registration => {
  const global = globalThis as {
    [REGISTRY]?: WeakMap<typeof registerTelemetry, Map<string, Registration>>
  }
  const byCopy = (global[REGISTRY] ??= new WeakMap())
  let byKey = byCopy.get(registerTelemetry)
  if (!byKey) byCopy.set(registerTelemetry, (byKey = new Map()))
  const existing = byKey.get(key)
  if (existing) return existing
  const created: Registration = { integration: null }
  byKey.set(key, created)
  registerTelemetry({
    onStepEnd: (step) => created.integration?.onStepEnd?.(step),
  })
  return created
}

// ---- the plugin ------------------------------------------------------------

/**
 * Metering and billing for the Vercel AI SDK. Every completion records one
 * event with its tokens, model, and cost of goods, whatever the mode; per
 * model token totals and a `cost` meter fall out of it for the merchant.
 * `billing` decides how the customer pays: per token, actual cost plus a
 * markup, or credits from a pool. The gate, the fallback ladder and the
 * product terms all speak that mode's unit. `gateway` names who routes the
 * calls upstream; none by default, which cost-plus and bare model ids need.
 *
 * Two ways to feed it: `scope.ai.model()` wraps a language model so every
 * call is gated and recorded as the scope's identity; `capture` records every
 * AI SDK call in the process from its lifecycle events, with nothing wrapped.
 * Any other client records through `scope.ai.record` and gates through
 * `scope.ai.check`, which need nothing from the AI SDK.
 */
export const llm = <
  const Models extends string,
  Extra extends Metadata = Record<never, never>,
  B extends Billing<Models> = Billing<Models>,
>({
  models: names,
  billing,
  gateway = direct(),
  onUnknownModel = (model: UnknownModel) =>
    console.warn(
      `void llm: ${model.provider} reported model ${model.modelId}, recorded as ${model.canonical}, which is not in models and bills as other`,
    ),
  key = 'llm',
  capture,
}: LlmOptions<Models, Extra, B>): PluginDef<
  'llm',
  LlmSchema<Models, Extra, B>,
  LlmVerbs<Models, Extra, B>,
  LlmSnapshot<Models, B>
> &
  LlmSchema<Models, Extra, B> &
  LlmPlugin<Models, Extra, B> => {
  if (billing.mode === 'costPlus') {
    if (!gateway.reportsCost)
      throw new Error(
        `llm: costPlus bills what the gateway charged, and the ${gateway.name} gateway reports no cost; route calls through vercelGateway() or openrouter(), or bill perToken`,
      )
    if (gateway.prices === undefined && billing.prices === undefined)
      throw new Error(
        `llm: costPlus needs list prices to gate on, and the ${gateway.name} gateway has no catalogue; pass costPlus({ prices })`,
      )
  }
  const core = buildCore<Models, Extra, B>({
    plugin: 'llm',
    models: names,
    billing,
    key,
    listPrices: gateway.prices,
  })
  const canonical = canonicalizer(names, onUnknownModel)

  type Verbs = LlmVerbs<Models, Extra, B>

  const def = plugin('llm', {
    schema: core.schema,
    runtime: (untyped, context): Verbs => {
      const queries = untyped as unknown as Loose
      const base = core.verbs(queries)
      const { record, check } = base

      const model: SdkVerbs<Extra>['model'] = (input, ...args) => {
        const [options] = args as [ModelOptions<Extra>?]
        const {
          tags: extra = {} as Extra,
          gate = 'block',
          maxOutputTokens: defaultMaxOutput = 4096,
          minRemaining = 0,
          allow,
          onEnd,
          onDenied,
          onError,
        } = options ?? ({} as ModelOptions<Extra>)

        // A bare id resolves like the AI SDK resolves it, through the app's
        // default provider, else through the gateway.
        const target =
          typeof input === 'string'
            ? (globalThis.AI_SDK_DEFAULT_PROVIDER?.languageModel(input) ??
              gateway.resolve(input))
            : input
        const name = canonical(target.provider, target.modelId)

        /** The prompt is walked once per call, however many checks look at it. */
        const estimates = new WeakMap<CallOptions, Estimate>()
        const estimateFor = (params: CallOptions): Estimate => {
          let estimate = estimates.get(params)
          if (estimate === undefined) {
            estimate = {
              inputTokens: estimateInputTokens(params.prompt),
              maxOutputTokens: params.maxOutputTokens ?? defaultMaxOutput,
            }
            estimates.set(params, estimate)
          }
          return estimate
        }
        const checkFor =
          (params: CallOptions): CallStart['check'] =>
          (override = {}) => {
            const estimate = estimateFor(params)
            return check({
              model: name,
              inputTokens: override.inputTokens ?? estimate.inputTokens,
              maxOutputTokens:
                override.maxOutputTokens ?? estimate.maxOutputTokens,
            })
          }
        const deny = async (call: CallDenied) => {
          await onDenied?.(call)
          const detail = call.check ? ` (${call.check.reason})` : ''
          const message = `llm: ${call.model} denied by ${call.by} for ${context.id}${detail}`
          if (call.by === 'gate' && gate === 'warn') {
            console.warn(message)
            return
          }
          throw new VoidError({ reason: 'denied', message })
        }

        /** The gate, then the caller's veto. */
        const before = async (params: CallOptions, provider: string) => {
          const check = checkFor(params)
          if (gate !== 'off' && !routed.get(params)?.prechecked) {
            const result = await check()
            if (!result.allowed)
              await deny({ model: name, check: result, by: 'gate' })
          }
          const verdict = await allow?.({
            model: name,
            provider,
            estimate: estimateFor(params),
            params,
            check,
          })
          if (verdict === false)
            await deny({ model: name, check: null, by: 'allow' })
        }
        /** The record, from what the provider reported. */
        const finish = async (
          params: CallOptions,
          provider: string,
          done: Finished,
          responseId: string | null,
          started: number,
        ) => {
          const completion = await record({
            ...extra,
            model: name,
            provider,
            ...fromProviderUsage(done.usage),
            ...costDetails(gateway, done.providerMetadata, responseId),
            response_id: responseId,
            call_id: null,
            step: null,
            fallback_from: routed.get(params)?.from ?? null,
            finish_reason: done.finishReason.unified,
            latency_ms: Date.now() - started,
          } as LlmCompletion<Extra>)
          await onEnd?.({ completion })
        }
        const middleware: LanguageModelMiddleware = {
          // Lift last: the gate and the record look the routing up by the
          // params object the AI SDK hands to wrapGenerate, which is what
          // this returns.
          transformParams: async ({ params }) =>
            liftRouting(gateway.tagParams(params, context.id, extra)),
          wrapGenerate: async ({ doGenerate, params, model: provider }) => {
            await before(params, provider.provider)
            const started = Date.now()
            try {
              const result = await doGenerate()
              await finish(
                params,
                provider.provider,
                result,
                result.response?.id ?? null,
                started,
              )
              return {
                ...result,
                providerMetadata: markRecorded(
                  result.providerMetadata,
                  context.id,
                ),
              }
            } catch (error) {
              onError?.(error)
              throw error
            }
          },
          wrapStream: async ({ doStream, params, model: provider }) => {
            await before(params, provider.provider)
            const started = Date.now()
            const { stream, ...rest } = await doStream()
            let responseId: string | null = null
            const observe = new TransformStream<StreamPart, StreamPart>({
              transform: async (part, controller) => {
                if (part.type === 'response-metadata')
                  responseId = part.id ?? null
                if (part.type !== 'finish') {
                  controller.enqueue(part)
                  return
                }
                const done: FinishPart = part
                // The consumer sees the end of the stream before the record
                // round-trips; the stream still closes only once it has.
                controller.enqueue({
                  ...done,
                  providerMetadata: markRecorded(
                    done.providerMetadata,
                    context.id,
                  ),
                })
                try {
                  await finish(
                    params,
                    provider.provider,
                    done,
                    responseId,
                    started,
                  )
                } catch (error) {
                  onError?.(error)
                }
              },
            })
            return { ...rest, stream: stream.pipeThrough(observe) }
          },
        }
        const wrapped = wrapLanguageModel({ model: target, middleware })
        const tier: Tier = {
          check: (params) => checkFor(params)(),
          minRemaining,
        }
        return Object.assign(wrapped, { [METERED]: tier }) as MeteredModel
      }

      const telemetry: SdkVerbs<Extra>['telemetry'] = (...args) => {
        const [extra = {} as Extra] = args as [Extra?]
        return {
          onStepEnd: async (step) => {
            if (recordedBy(step.providerMetadata) !== null) return
            await record(completionFromStep(step, extra, gateway, canonical))
          },
        }
      }

      return { ...base, model, telemetry } as Verbs
    },
    snapshot: (meters): LlmSnapshot<Models, B> =>
      core.snapshot(
        meters as unknown as Readonly<Record<string, MeterSnapshot>>,
      ),
    attach: (client) => {
      if (capture === false) return
      const holder = registration(key)
      const integration = globalTelemetry(
        client,
        ...([capture] as CaptureArgs<Extra>),
      )
      holder.integration = integration
      return () => {
        if (holder.integration === integration) holder.integration = null
      }
    },
  })

  const globalTelemetry: LlmPlugin<Models, Extra, B>['telemetry'] = (
    client,
    ...args
  ) => {
    const [options] = args as [CaptureOptions<Extra>?]
    const {
      tags: extra,
      identity = (step: Step) => {
        const named = (step.runtimeContext as Record<string, unknown>)?.[
          'voidIdentity'
        ]
        return typeof named === 'string' ? named : undefined
      },
      onUnknownIdentity,
      onError = (error: unknown, step: Step) =>
        console.error(
          `void llm: failed to record a ${step.model.modelId} step`,
          error,
        ),
    } = options ?? ({} as CaptureOptions<Extra>)
    const exportName = Object.entries(client.config.schema).find(
      ([, value]) => value === def,
    )?.[0]
    if (exportName === undefined)
      throw new VoidError({
        reason: 'not_in_config',
        message:
          'llm.telemetry: this plugin is not exported by the client config',
      })
    const verbs = (id: string) =>
      (client.as(id) as Record<string, Verbs>)[exportName]!
    const resolve = (step: Step) => {
      const scope = client.ambient()
      return scope
        ? { id: scope.id, tags: scope.tags }
        : { id: identity(step), tags: {} as Metadata }
    }
    return {
      onStepEnd: async (step) => {
        if (recordedBy(step.providerMetadata) !== null) return
        const { id, tags } = resolve(step)
        if (id === undefined) {
          onUnknownIdentity?.(step)
          return
        }
        try {
          const completionTags = (
            typeof extra === 'function' ? extra(step, tags) : (extra ?? tags)
          ) as Extra
          await verbs(id).record(
            completionFromStep(step, completionTags, gateway, canonical),
          )
        } catch (error) {
          onError(error, step)
        }
      },
    }
  }

  return Object.assign(def, core.schema, {
    models: core.models,
    other: core.other,
    meters: core.meters,
    telemetry: globalTelemetry,
  })
}

// ---- ladders ---------------------------------------------------------------

/**
 * A ladder: several metered models, most to least preferred, as one model.
 * Each provider call runs the first tier whose check allows it with at least
 * its `minRemaining` to spare; when none does, the last tier runs and its own
 * gate decides. The completion records which tier ran and where it fell
 * from. Tiers may belong to different identities or plugins.
 */
export const fallback = (
  models: readonly MeteredModel[],
  options: FallbackOptions = {},
): ProviderModel => {
  if (models.length === 0)
    throw new VoidError({
      reason: 'invalid_argument',
      message: 'fallback: a ladder needs at least one model',
    })
  for (const model of models as readonly ProviderModel[])
    if (!(METERED in model))
      throw new VoidError({
        reason: 'invalid_argument',
        message: `fallback: ${model.modelId} is not a metered model; wrap it with scope.ai.model first`,
      })
  const first = models[0]!
  const last = models[models.length - 1]!

  /** The first tier with room, else the last, which its own gate then judges. */
  const pick = async (params: CallOptions) => {
    const skipped: Skipped[] = []
    for (const tier of models.slice(0, -1)) {
      const { check, minRemaining } = tier[METERED]
      const result = await check(params)
      const room = result.remaining
      if (result.allowed && (room === null || room >= minRemaining))
        return { tier, skipped, prechecked: true }
      skipped.push({ model: tier.modelId, check: result })
    }
    return { tier: last, skipped, prechecked: false }
  }
  const route = async (params: CallOptions) => {
    const { tier, skipped, prechecked } = await pick(params)
    if (tier !== first)
      await options.onFallback?.({ to: tier.modelId, skipped })
    return {
      tier,
      params: withRouting(params, {
        from: tier === first ? null : first.modelId,
        prechecked,
      }),
    }
  }

  return {
    specificationVersion: 'v4',
    provider: first.provider,
    modelId: models.map((t) => t.modelId).join(' > '),
    supportedUrls: first.supportedUrls,
    doGenerate: async (params) => {
      const chosen = await route(params)
      return chosen.tier.doGenerate(chosen.params)
    },
    doStream: async (params) => {
      const chosen = await route(params)
      return chosen.tier.doStream(chosen.params)
    },
  }
}
