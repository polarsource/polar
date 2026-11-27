import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Ingestion } from '@polar-sh/ingestion'
import { S3Strategy } from '@polar-sh/ingestion/strategies/S3'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { after } from 'next/server'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

const s3Ingestion = Ingestion(metering)
  .strategy(new S3Strategy(new S3Client({ region: process.env.AWS_REGION })))
  .ingest('file_uploaded')

export async function POST(req: Request) {
  const s3 = s3Ingestion.client({ external_customer_id: 'user_123' })

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: crypto.randomUUID(),
      Body: new Uint8Array(await req.arrayBuffer()),
      ContentType:
        req.headers.get('content-type') ?? 'application/octet-stream',
    }),
  )

  after(() => metering.flush())

  return Response.json({})
}
