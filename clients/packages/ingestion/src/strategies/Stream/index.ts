import type { Stream } from 'node:stream'
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
  type IngestionStrategyContext,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from '../../strategy'

export type StreamStrategyContext = IngestionStrategyContext & {
  bytes: number
  strategy: 'Stream'
}

export class StreamStrategy<TStream extends Stream> extends IngestionStrategy<
  StreamStrategyContext,
  TStream
> {
  private stream: Stream

  constructor(stream: Stream) {
    super()

    this.stream = stream
  }

  private wrapStream({
    stream,
    execute,
    customer,
  }: {
    stream: TStream
    execute: IngestionExecutionHandler<StreamStrategyContext>
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer
  }) {
    let bytes = 0

    stream.on('data', (chunk) => {
      bytes += chunk.length
    })

    stream.on('end', () => {
      const payload: StreamStrategyContext = {
        bytes,
        strategy: 'Stream',
      }

      execute(payload, customer)
    })

    return stream
  }

  public client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): TStream {
    const execute = this.createExecutionHandler()

    return this.wrapStream({
      stream: this.stream as TStream,
      execute,
      customer,
    })
  }
}
