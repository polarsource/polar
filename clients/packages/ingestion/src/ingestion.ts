import {
  createPolar,
  type Environment,
  type models,
  type Polar,
} from '@polar-sh/sdk/2027-01'
import type { EventInput, Metering } from '@polar-sh/sdk/metering'
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

// The camelCase event of the old SDK that 0.4 users pass to ingest()
export type IngestionCamelCaseEvent = {
  name: string
  timestamp?: Date | string
  organizationId?: string | null
  externalId?: string | null
  parentId?: string | null
  metadata?: models.EventCreateCustomer['metadata']
} & (
  | { customerId: string; memberId?: string | null }
  | { externalCustomerId: string; externalMemberId?: string | null }
)

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

const customerKeys = new Set([
  'customerId',
  'externalCustomerId',
  'customer_id',
  'external_customer_id',
])

const snakeCaseKeys: Record<string, string> = {
  organizationId: 'organization_id',
  externalId: 'external_id',
  parentId: 'parent_id',
  memberId: 'member_id',
  externalMemberId: 'external_member_id',
}

// SDK 1.x sends events as given, and the API ignores camelCase keys
const encodeEvent = (
  event: IngestionEvent | IngestionCamelCaseEvent,
): IngestionEvent =>
  ({
    ...Object.fromEntries(
      Object.entries(event)
        .filter(([key]) => !customerKeys.has(key))
        .map(([key, value]) => [snakeCaseKeys[key] ?? key, value]),
    ),
    ...encodeCustomer(event),
  }) as IngestionEvent

const toEventMetadata = (
  metadata: Record<string, IngestionMetadataValue | models.CostMetadataInput>,
): EventInput['metadata'] => {
  const eventMetadata = metadata as EventInput['metadata']
  const _llm = Option.getOrUndefined(encodeLLMUsage(metadata._llm))

  return _llm ? { ...eventMetadata, _llm } : eventMetadata
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
        ...encodeCustomer(customer),
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
  ingest: (
    events: (IngestionEvent | IngestionCamelCaseEvent)[],
  ) => Promise<models.EventsIngestResponse>
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
    ingest: (events: (IngestionEvent | IngestionCamelCaseEvent)[]) =>
      createTokenClient(config).events.ingest({
        events: events.map(encodeEvent),
      }),
  }
}
