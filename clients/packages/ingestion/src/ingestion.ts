import {
  createPolar,
  type Environment,
  type models,
  type Polar,
} from '@polar-sh/sdk/2027-01'
import type { EventInput, Metering } from '@polar-sh/sdk/metering'
import * as Schema from 'effect/Schema'
import type {
  IngestionStrategy,
  IngestionStrategyContext,
  IngestionStrategyCustomer,
  IngestionStrategyExternalCustomer,
} from './strategy'

export type IngestionMetadataValue =
  | string
  | number
  | boolean
  | { [key: string]: string | number | boolean | null | undefined }

export type IngestionContext<
  TContext extends Record<string, IngestionMetadataValue> = Record<
    string,
    IngestionMetadataValue
  >,
> = TContext

type Transformer<TContext extends IngestionContext> = (
  ctx: TContext,
  customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
) => Promise<void>

export type Span = {
  name: string
  startTime: number
  endTime: number
}

export type IngestionEvent =
  | models.EventCreateCustomer
  | models.EventCreateExternalCustomer

// The options of the old SDK that 0.4 users pass, mapped onto the new one
export type IngestionTokenConfig = {
  accessToken?: string
  server?: Environment
  serverURL?: string
}

export const createTokenClient = (config?: IngestionTokenConfig): Polar =>
  createPolar({
    accessToken: config?.accessToken ?? process.env.POLAR_ACCESS_TOKEN ?? '',
    environment: config?.server,
    baseUrl: config?.serverURL,
  })

export const LLMUsage = Schema.Struct({
  inputTokens: Schema.Finite,
  outputTokens: Schema.Finite,
  totalTokens: Schema.Finite,
  cachedInputTokens: Schema.Finite,
  vendor: Schema.String,
  model: Schema.String,
})

const isLLMUsage = Schema.is(LLMUsage)

const snakeCustomer = (
  customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
): { customer_id: string } | { external_customer_id: string } => {
  if ('customerId' in customer) return { customer_id: customer.customerId }

  if ('externalCustomerId' in customer) {
    return { external_customer_id: customer.externalCustomerId }
  }

  return customer
}

// The API reads _llm in snake_case, the LLM strategy builds it in camelCase
const toEventMetadata = (
  metadata: Record<string, IngestionMetadataValue | models.CostMetadataInput>,
): EventInput['metadata'] => {
  // SAFETY: besides primitives, contexts only hold _cost and _llm objects, the two the API accepts
  const eventMetadata = metadata as EventInput['metadata']
  const { _llm } = metadata

  if (!isLLMUsage(_llm)) return eventMetadata

  return {
    ...eventMetadata,
    _llm: {
      vendor: _llm.vendor,
      model: _llm.model,
      input_tokens: _llm.inputTokens,
      cached_input_tokens: _llm.cachedInputTokens,
      output_tokens: _llm.outputTokens,
      total_tokens: _llm.totalTokens,
    },
  }
}

export class PolarIngestion<TContext extends IngestionContext> {
  public polarClient?: Polar
  public metering?: Metering
  private transformers: Transformer<TContext>[] = []
  public costResolver?: (ctx: TContext) => models.CostMetadataInput
  public span?: Span

  private pipe(transformer: Transformer<TContext>) {
    this.transformers.push(transformer)

    return this
  }

  public async execute(
    ctx: TContext,
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ) {
    await Promise.all(
      this.transformers.map((transformer) => transformer(ctx, customer)),
    )
  }

  public schedule(
    meter: string,
    metadataResolver?: (
      ctx: TContext,
    ) => Record<string, IngestionMetadataValue>,
  ) {
    return this.pipe(async (ctx, customer) => {
      const event: EventInput = {
        ...snakeCustomer(customer),
        name: meter,
        metadata: toEventMetadata({
          ...(metadataResolver ? metadataResolver(ctx) : ctx),
          ...(this.costResolver ? { _cost: this.costResolver(ctx) } : {}),
        }),
      }

      if (this.metering) {
        await this.metering.track(event)

        return
      }

      if (!this.polarClient) {
        throw new Error('Polar client not initialized')
      }

      await this.polarClient.events.ingest({
        events: [event],
      })
    })
  }
}

type IngestionStrategyAttacher = <
  TContext extends IngestionStrategyContext,
  TStrategyClient,
>(
  strategy: IngestionStrategy<TContext, TStrategyClient>,
) => IngestionStrategy<TContext, TStrategyClient>

export function Ingestion(metering: Metering): {
  strategy: IngestionStrategyAttacher
  ingest: (events: EventInput[]) => Promise<void>
}
export function Ingestion(config?: IngestionTokenConfig): {
  strategy: IngestionStrategyAttacher
  ingest: (events: IngestionEvent[]) => Promise<models.EventsIngestResponse>
}
export function Ingestion(config?: IngestionTokenConfig | Metering) {
  if (config && 'track' in config) {
    return {
      strategy: ((strategy) => {
        strategy.metering = config

        return strategy
      }) satisfies IngestionStrategyAttacher,
      ingest: async (events: EventInput[]) => {
        await Promise.all(events.map((event) => config.track(event)))
      },
    }
  }

  return {
    strategy: ((strategy) => {
      strategy.polarClient = createTokenClient(config)

      return strategy
    }) satisfies IngestionStrategyAttacher,
    ingest: (events: IngestionEvent[]) =>
      createTokenClient(config).events.ingest({ events }),
  }
}
