import type { S3Client } from '@aws-sdk/client-s3'
import * as Schema from 'effect/Schema'
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
  type IngestionStrategyContext,
  type IngestionStrategyCustomer,
  type IngestionStrategyExternalCustomer,
} from '../../strategy'

export const S3StrategyContext = Schema.toStandardSchemaV1(
  Schema.Struct({
    bucket: Schema.optional(Schema.String),
    key: Schema.optional(Schema.String),
    contentType: Schema.optional(Schema.String),
    bytes: Schema.Finite,
    strategy: Schema.Literal('S3'),
  }),
)

export type S3StrategyContext = IngestionStrategyContext &
  typeof S3StrategyContext.Type

export class S3Strategy extends IngestionStrategy<S3StrategyContext, S3Client> {
  private s3Client: S3Client

  constructor(s3Client: S3Client) {
    super()

    this.s3Client = s3Client
  }

  private wrapS3Client({
    s3Client,
    execute,
    customer,
  }: {
    s3Client: S3Client
    execute: IngestionExecutionHandler<S3StrategyContext>
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer
  }) {
    const plugin: Parameters<S3Client['middlewareStack']['use']>[0] = {
      applyToStack: (stack) => {
        stack.add(
          (next, _context) => async (args) => {
            const result = await next(args)

            const bytes =
              'request' in args
                ? Number.parseInt(
                    // @ts-expect-error request is typed as unknown in the middleware args
                    args.request.headers['content-length'] ?? '0',
                  )
                : 0

            if (bytes > 0) {
              const { input } = args
              const payload: S3StrategyContext = {
                bytes,
                strategy: 'S3',
                ...('Bucket' in input && { bucket: input.Bucket }),
                ...('Key' in input && { key: input.Key }),
                ...('ContentType' in input && {
                  contentType: input.ContentType,
                }),
              }

              execute(payload, customer)
            }

            return result
          },
          {
            step: 'deserialize',
            priority: 'high',
          },
        )
      },
    }

    // Tracking added to the shared client would bill every customer it has seen for each upload
    const tracked: S3Client = Object.assign(
      Object.create(Object.getPrototypeOf(s3Client)),
      s3Client,
      // The copy must not reuse handlers cached for the shared middleware stack
      { handlers: undefined },
    )
    tracked.middlewareStack = s3Client.middlewareStack.clone()
    tracked.middlewareStack.use(plugin)

    return tracked
  }

  public client(
    customer: IngestionStrategyCustomer | IngestionStrategyExternalCustomer,
  ): S3Client {
    const execute = this.createExecutionHandler()

    return this.wrapS3Client({
      s3Client: this.s3Client,
      execute,
      customer,
    })
  }
}
