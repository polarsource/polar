import { Ingestion } from '@polar-sh/ingestion'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { after } from 'next/server'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

const ingestion = Ingestion(metering)

export async function POST() {
  await ingestion.ingest([
    {
      name: 'api_request',
      external_customer_id: 'user_123',
      metadata: {
        route: '/search',
        _cost: { amount: 2, currency: 'usd' },
      },
    },
  ])

  after(() => metering.flush())

  return Response.json({})
}
