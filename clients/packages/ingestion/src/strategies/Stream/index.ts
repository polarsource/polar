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
  private customer?:
    | IngestionStrategyCustomer
    | IngestionStrategyExternalCustomer

  constructor(stream: Stream) {
    super()

    this.stream = stream
  }

  private wrapStream({
    stream,
    execute,
  }: {
    stream: TStream
    execute: IngestionExecutionHandler<StreamStrategyContext>
  }) {
    let bytes = 0
    const emit = stream.emit

    // A 'data' listener would start the stream and drain it before the caller reads it
    stream.emit = (event: string | symbol, ...args: unknown[]) => {
      if (event === 'data') {
        const [chunk] = args
        if (typeof chunk === 'string') {
          bytes += Buffer.byteLength(chunk)
        } else if (chunk instanceof Uint8Array) {
          bytes += chunk.byteLength
        }
      }

      return emit.call(stream, event, ...args)
    }

    stream.on('end', () => {
      const payload: StreamStrategyContext = {
        bytes,
        strategy: 'Stream',
      }

      if (this.customer) {
        execute(payload, this.customer)
      }
    })

    return stream
  }

  public client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): TStream {
    const stream = this.stream as TStream

    if (!this.customer) {
      this.wrapStream({ stream, execute: this.createExecutionHandler() })
    }

    this.customer = customer

    return stream
  }
}
