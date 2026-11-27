import * as Schema from 'effect/Schema'
import {
  IngestionStrategy,
  type IngestionStrategyContext,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from '../../strategy'

export const DeltaTimeStrategyContext = Schema.toStandardSchemaV1(
  Schema.Struct({
    deltaTime: Schema.Finite,
    strategy: Schema.Literal('DeltaTime'),
  }),
)

export type DeltaTimeStrategyContext = IngestionStrategyContext &
  typeof DeltaTimeStrategyContext.Type

type DeltaTimeStrategyNowResolver = () => number

type DeltaTimeStrategyStart = () => DeltaTimeStrategyStop
type DeltaTimeStrategyStop = () => number

export class DeltaTimeStrategy extends IngestionStrategy<
  DeltaTimeStrategyContext,
  DeltaTimeStrategyStart
> {
  public startTime = 0
  public endTime = 0
  public nowResolver: DeltaTimeStrategyNowResolver

  constructor(now: DeltaTimeStrategyNowResolver) {
    super()

    this.nowResolver = now
  }

  public client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): DeltaTimeStrategyStart {
    return () => {
      const startTime = this.nowResolver()

      return () => {
        const endTime = this.nowResolver()
        const deltaTime = endTime - startTime

        const execute = this.createExecutionHandler()
        execute({ deltaTime, strategy: 'DeltaTime' }, customer)

        return deltaTime
      }
    }
  }
}
