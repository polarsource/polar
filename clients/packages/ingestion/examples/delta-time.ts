import { setTimeout } from 'node:timers/promises'
import { Ingestion } from '@polar-sh/ingestion'
import { DeltaTimeStrategy } from '@polar-sh/ingestion/strategies/DeltaTime'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { after } from 'next/server'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

const deltaTimeIngestion = Ingestion(metering)
  .strategy(new DeltaTimeStrategy(() => performance.now()))
  .ingest('execution_time')

export async function POST() {
  const start = deltaTimeIngestion.client({ external_customer_id: 'user_123' })

  const stop = start()
  await setTimeout(1000)
  const deltaTime = stop()

  after(() => metering.flush())

  return Response.json({ deltaTime })
}
