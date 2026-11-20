import {
  createPolar,
  type Environment,
  type models,
  type Polar,
} from '@polar-sh/sdk/2027-01'
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

export type IngestionMeteringEvent = (
  | { customer_id: string }
  | { external_customer_id: string }
) & {
  name: string
  metadata?: Record<string, unknown>
}

// Anything shaped like polar.metering(), so an app's own copy of the SDK fits
export interface IngestionMetering {
  track(event: IngestionMeteringEvent): Promise<unknown>
}

// The options of the old SDK that 0.4 users pass, mapped onto the new one
export type IngestionTokenConfig = {
  accessToken?: string
  server?: Environment
  serverURL?: string
}

export const createTokenClient = (config?: IngestionTokenConfig): Polar =>
  createPolar({
    accessToken: config?.accessToken ?? '',
    environment: config?.server,
    baseUrl: config?.serverURL,
  })

const toSnakeCase = (key: string) =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

const snakeCustomer = (
  customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
): { customer_id: string } | { external_customer_id: string } => {
  if ('customerId' in customer) return { customer_id: customer.customerId }
  if ('externalCustomerId' in customer) {
    return { external_customer_id: customer.externalCustomerId }
  }
  return customer
}

// The API reads _llm in snake_case, the strategies build it in camelCase
const snakeLLMMetadata = (metadata: Record<string, unknown>) => {
  const { _llm } = metadata
  if (!_llm || typeof _llm !== 'object') return metadata
  return {
    ...metadata,
    _llm: Object.fromEntries(
      Object.entries(_llm).map(([key, value]) => [toSnakeCase(key), value]),
    ),
  }
}

export class PolarIngestion<TContext extends IngestionContext> {
  public polarClient?: Polar
  public metering?: IngestionMetering
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
      const event = {
        ...snakeCustomer(customer),
        name: meter,
        metadata: snakeLLMMetadata({
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
        events: [event as IngestionEvent],
      })
    })
  }
}

const isMetering = (
  config?: IngestionTokenConfig | IngestionMetering,
): config is IngestionMetering =>
  typeof (config as IngestionMetering | undefined)?.track === 'function'

type IngestionStrategyAttacher = <
  TContext extends IngestionStrategyContext,
  TStrategyClient,
>(
  strategy: IngestionStrategy<TContext, TStrategyClient>,
) => IngestionStrategy<TContext, TStrategyClient>

export function Ingestion<TMetering extends IngestionMetering>(
  metering: TMetering,
): {
  strategy: IngestionStrategyAttacher
  ingest: (events: Parameters<TMetering['track']>[0][]) => Promise<void>
}
export function Ingestion(config?: IngestionTokenConfig): {
  strategy: IngestionStrategyAttacher
  ingest: (events: IngestionEvent[]) => Promise<models.EventsIngestResponse>
}
export function Ingestion(config?: IngestionTokenConfig | IngestionMetering) {
  if (isMetering(config)) {
    return {
      strategy: ((strategy) => {
        strategy.metering = config
        return strategy
      }) satisfies IngestionStrategyAttacher,
      ingest: async (events: IngestionMeteringEvent[]) => {
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
