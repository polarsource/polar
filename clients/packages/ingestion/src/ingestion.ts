import {
  createPolar,
  type Environment,
  type models,
  type Polar,
} from '@polar-sh/sdk/2027-01'
import type { EventInput } from '@polar-sh/sdk/metering'
import * as Option from 'effect/Option'
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

// The API reads _llm in snake_case, the LLM strategy builds it in camelCase
const encodeLLMUsage = Schema.encodeUnknownOption(
  LLMUsage.pipe(
    Schema.encodeKeys({
      inputTokens: 'input_tokens',
      outputTokens: 'output_tokens',
      totalTokens: 'total_tokens',
      cachedInputTokens: 'cached_input_tokens',
    }),
  ),
)

const encodeCustomer = Schema.encodeSync(
  Schema.Union([
    Schema.Struct({ customerId: Schema.String }).pipe(
      Schema.encodeKeys({ customerId: 'customer_id' }),
    ),
    Schema.Struct({ externalCustomerId: Schema.String }).pipe(
      Schema.encodeKeys({ externalCustomerId: 'external_customer_id' }),
    ),
    Schema.Struct({ customer_id: Schema.String }),
    Schema.Struct({ external_customer_id: Schema.String }),
  ]),
)

const toEventMetadata = (
  metadata: Record<string, IngestionMetadataValue | models.CostMetadataInput>,
): EventInput['metadata'] => {
  const eventMetadata = metadata as EventInput['metadata']
  const _llm = Option.getOrUndefined(encodeLLMUsage(metadata._llm))

  return _llm ? { ...eventMetadata, _llm } : eventMetadata
}

type EventTracker = { track(event: EventInput): Promise<void> }

export class PolarIngestion<TContext extends IngestionContext> {
  public polarClient?: Polar
  public eventTracker?: EventTracker
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
        ...encodeCustomer(customer),
        name: meter,
        metadata: toEventMetadata({
          ...(metadataResolver ? metadataResolver(ctx) : ctx),
          ...(this.costResolver ? { _cost: this.costResolver(ctx) } : {}),
        }),
      }

      if (this.eventTracker) {
        await this.eventTracker.track(event)

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

export function Ingestion(client: EventTracker): {
  strategy: IngestionStrategyAttacher
  ingest: (events: EventInput[]) => Promise<void>
}
export function Ingestion(config?: IngestionTokenConfig): {
  strategy: IngestionStrategyAttacher
  ingest: (events: IngestionEvent[]) => Promise<models.EventsIngestResponse>
}
export function Ingestion(config?: IngestionTokenConfig | EventTracker) {
  if (config && 'track' in config) {
    return {
      strategy: ((strategy) => {
        strategy.eventTracker = config

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
