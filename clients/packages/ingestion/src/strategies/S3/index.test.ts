import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { S3Strategy, S3StrategyContext } from '.'
import { Ingestion } from '../../ingestion'

const createS3Client = (config: S3ClientConfig = {}) =>
  new S3Client({
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    requestHandler: {
      handle: async () => ({
        response: { statusCode: 200, headers: {}, body: Readable.from([]) },
      }),
    },
    ...config,
  })

const trackUploads = (s3Client: S3Client) => {
  const strategy = Ingestion()
    .strategy(new S3Strategy(s3Client))
    .ingest('s3-bytes')
  const ingest = vi
    .spyOn(strategy.polarClient!.events, 'ingest')
    .mockResolvedValue({ inserted: 1 })

  return { strategy, ingest }
}

const upload = (key: string) =>
  new PutObjectCommand({ Bucket: 'bucket', Key: key, Body: 'hello' })

const billedCustomers = (ingest: ReturnType<typeof trackUploads>['ingest']) =>
  ingest.mock.calls.flatMap(([{ events }]) =>
    events.map((event) => ('customer_id' in event ? event.customer_id : null)),
  )

describe('S3Strategy', () => {
  it('should send metadata that S3StrategyContext accepts', async () => {
    const { strategy, ingest } = trackUploads(createS3Client())

    await strategy.client({ customerId: 'alice' }).send(upload('key'))

    const [{ metadata }] = ingest.mock.calls[0][0].events
    expect(await S3StrategyContext['~standard'].validate(metadata)).toEqual({
      value: metadata,
    })
  })

  it('should send metadata that S3StrategyContext accepts when ContentType is undefined', async () => {
    const { strategy, ingest } = trackUploads(createS3Client())

    await strategy.client({ customerId: 'alice' }).send(
      new PutObjectCommand({
        Bucket: 'bucket',
        Key: 'key',
        Body: 'hello',
        ContentType: undefined,
      }),
    )

    const [{ metadata }] = ingest.mock.calls[0][0].events
    expect(await S3StrategyContext['~standard'].validate(metadata)).toEqual({
      value: metadata,
    })
  })

  it('should send the uploaded bytes for the customer', async () => {
    const { strategy, ingest } = trackUploads(createS3Client())

    await strategy.client({ customerId: 'alice' }).send(upload('key'))

    expect(ingest).toHaveBeenCalledExactlyOnceWith({
      events: [
        {
          customer_id: 'alice',
          name: 's3-bytes',
          metadata: { bytes: 5, strategy: 'S3', bucket: 'bucket', key: 'key' },
        },
      ],
    })
  })

  it('should send one event for an upload after client() was called for two customers', async () => {
    const { strategy, ingest } = trackUploads(createS3Client())

    strategy.client({ customerId: 'alice' })
    await strategy.client({ customerId: 'bob' }).send(upload('key'))

    expect(billedCustomers(ingest)).toEqual(['bob'])
  })

  it('should bill each upload to its own customer when client() is called per request', async () => {
    const { strategy, ingest } = trackUploads(createS3Client())

    for (const customerId of ['alice', 'bob', 'carol']) {
      await strategy.client({ customerId }).send(upload(customerId))
    }

    expect(billedCustomers(ingest)).toEqual(['alice', 'bob', 'carol'])
  })

  it('should not track uploads made on the client passed to the strategy', async () => {
    const s3Client = createS3Client()
    const { strategy, ingest } = trackUploads(s3Client)

    strategy.client({ customerId: 'alice' })
    await s3Client.send(upload('key'))

    expect(ingest).not.toHaveBeenCalled()
  })

  it('should send no event for commands that upload nothing', async () => {
    const { strategy, ingest } = trackUploads(createS3Client())
    const s3 = strategy.client({ customerId: 'alice' })

    await s3.send(new ListObjectsV2Command({ Bucket: 'bucket' }))
    await s3.send(new GetObjectCommand({ Bucket: 'bucket', Key: 'key' }))
    await s3.send(new DeleteObjectCommand({ Bucket: 'bucket', Key: 'key' }))

    expect(ingest).not.toHaveBeenCalled()
  })

  it('should track uploads when the S3 client caches its middleware', async () => {
    const s3Client = createS3Client({ cacheMiddleware: true })
    const { strategy, ingest } = trackUploads(s3Client)

    await s3Client.send(upload('untracked'))
    await strategy.client({ customerId: 'alice' }).send(upload('key'))

    expect(billedCustomers(ingest)).toEqual(['alice'])
  })

  it('should log a failed ingest without failing the S3 call', async () => {
    const { strategy, ingest } = trackUploads(createS3Client())
    ingest.mockRejectedValue(new Error('Polar is down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await strategy.client({ customerId: 'alice' }).send(upload('key'))

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1))
  })
})
