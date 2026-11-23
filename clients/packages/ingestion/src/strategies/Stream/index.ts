import type { Stream } from 'node:stream'
import * as Schema from 'effect/Schema'
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
  type IngestionStrategyContext,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from '../../strategy'

export const StreamStrategyContext = Schema.toStandardSchemaV1(
  Schema.Struct({
    bytes: Schema.Finite,
    strategy: Schema.Literal('Stream'),
  }),
)

export type StreamStrategyContext = IngestionStrategyContext &
  typeof StreamStrategyContext.Type

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

    // A stream is read once, so it stays with the first customer it was tracked for
    if (!this.customer) {
      this.customer = customer
      this.wrapStream({ stream, execute: this.createExecutionHandler() })
    }

    return stream
  }
}
