import { createReadStream, type ReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { Ingestion } from '@polar-sh/ingestion'
import { StreamStrategy } from '@polar-sh/ingestion/strategies/Stream'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { after } from 'next/server'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

export async function GET() {
  // A stream can only be read once, so set up the strategy for each stream
  const stream = Ingestion(metering)
    .strategy(new StreamStrategy<ReadStream>(createReadStream('./video.mp4')))
    .ingest('video_streamed')
    .client({ external_customer_id: 'user_123' })

  // The bytes read are ingested when the stream ends
  after(() => metering.flush())

  return new Response(Readable.toWeb(stream) as ReadableStream)
}
