import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

import { S3Strategy } from '.'
import { Ingestion } from '../../ingestion'

describe('S3Strategy', () => {
  it('should log a failed ingest without failing the S3 call', async () => {
    const s3Client = new S3Client({
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      requestHandler: {
        handle: async () => ({
          response: { statusCode: 200, headers: {}, body: Readable.from([]) },
        }),
      },
    })
    const strategy = Ingestion()
      .strategy(new S3Strategy(s3Client))
      .ingest('s3-bytes')
    vi.spyOn(strategy.polarClient!.events, 'ingest').mockRejectedValue(
      new Error('Polar is down'),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await strategy
      .client({ customerId: 'test-customer-id' })
      .send(
        new PutObjectCommand({ Bucket: 'bucket', Key: 'key', Body: 'hello' }),
      )

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1))
  })
})
