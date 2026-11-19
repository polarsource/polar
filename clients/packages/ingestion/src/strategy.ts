import type { CostMetadataInput } from '@polar-sh/sdk/models/components/costmetadatainput.js'
import { type IngestionContext, PolarIngestion } from './ingestion'

export type IngestionStrategyCustomer = {
  customerId: string
}

export type IngestionStrategyExternalCustomer = {
  externalCustomerId: string
}

export type IngestionExecutionHandler<TUsageContext extends IngestionContext> =
  (
    ctx: TUsageContext,
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ) => Promise<void>

export type IngestionStrategyContext = IngestionContext & {
  strategy: 'S3' | 'LLM' | 'DeltaTime' | 'Stream' | (string & {})
}

export abstract class IngestionStrategy<
  TUsageContext extends IngestionStrategyContext,
  TStrategyClient,
> extends PolarIngestion<TUsageContext> {
  public createExecutionHandler(): IngestionExecutionHandler<TUsageContext> {
    return async (
      context: TUsageContext,
      customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
    ) => {
      await this.execute(context, customer)
    }
  }

  public ingest(
    eventName: string,
    metadataResolver?: (
      ctx: TUsageContext,
    ) => Record<string, number | string | boolean>,
  ) {
    this.schedule(eventName, metadataResolver)

    return this
  }

  public cost(
    costResolver: (ctx: TUsageContext) => CostMetadataInput,
  ): IngestionStrategy<TUsageContext, TStrategyClient> {
    this.costResolver = costResolver
    return this
  }

  public abstract client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): TStrategyClient
}
