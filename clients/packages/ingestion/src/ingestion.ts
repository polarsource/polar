import { Polar, type SDKOptions } from '@polar-sh/sdk'
import type { EventCreateCustomer } from '@polar-sh/sdk/models/components/eventcreatecustomer.js'
import type {
  IngestionStrategy,
  IngestionStrategyContext,
  IngestionStrategyCustomer,
  IngestionStrategyExternalCustomer,
} from './strategy'
import type { EventMetadataInput } from '@polar-sh/sdk/models/components/eventmetadatainput.js'
import type { CostMetadataInput } from '@polar-sh/sdk/models/components/costmetadatainput.js'

export type IngestionContext<
  TContext extends Record<string, EventMetadataInput> = Record<
    string,
    EventMetadataInput
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

export class PolarIngestion<TContext extends IngestionContext> {
  public polarClient?: Polar
  private transformers: Transformer<TContext>[] = []
  public costResolver?: (ctx: TContext) => CostMetadataInput
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
    metadataResolver?: (ctx: TContext) => Record<string, EventMetadataInput>,
  ) {
    return this.pipe(async (ctx, customer) => {
      if (!this.polarClient) {
        throw new Error('Polar client not initialized')
      }

      await this.polarClient.events.ingest({
        events: [
          {
            ...customer,
            name: meter,
            metadata: {
              ...(metadataResolver ? metadataResolver(ctx) : ctx),
              ...(this.costResolver ? { _cost: this.costResolver(ctx) } : {}),
            },
          },
        ],
      })
    })
  }
}

export function Ingestion(polarConfig?: SDKOptions) {
  return {
    strategy: <TContext extends IngestionStrategyContext, TStrategyClient>(
      strategy: IngestionStrategy<TContext, TStrategyClient>,
    ) => {
      strategy.polarClient = new Polar(polarConfig)
      return strategy
    },
    ingest: async (events: (EventCreateCustomer | EventCreateCustomer)[]) => {
      const polar = new Polar(polarConfig)

      return polar.events.ingest({
        events,
      })
    },
  }
}
