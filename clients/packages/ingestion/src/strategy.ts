import type { models } from '@polar-sh/sdk/2027-01'
import { type IngestionContext, PolarIngestion } from './ingestion'

export type IngestionStrategyCustomer =
  | { customerId: string }
  | { customer_id: string }

export type IngestionStrategyExternalCustomer =
  | { externalCustomerId: string }
  | { external_customer_id: string }

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
      try {
        await this.execute(context, customer)
      } catch (error) {
        // The metered work is already done and most callers don't await this
        console.error('[@polar-sh/ingestion] Failed to ingest event', error)
      }
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
    costResolver: (ctx: TUsageContext) => models.CostMetadataInput,
  ): IngestionStrategy<TUsageContext, TStrategyClient> {
    this.costResolver = costResolver
    return this
  }

  public abstract client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): TStrategyClient
}
