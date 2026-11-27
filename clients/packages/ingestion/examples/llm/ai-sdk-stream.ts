import { openai } from '@ai-sdk/openai'
import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { streamText } from 'ai'
import { after } from 'next/server'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

const llmIngestion = Ingestion(metering)
  .strategy(new LLMStrategy(openai('gpt-4o')))
  .ingest('ai_usage')

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const model = llmIngestion.client({ external_customer_id: 'user_123' })

  // The usage is ingested when the stream finishes
  after(() => metering.flush())

  return streamText({ model, prompt }).toTextStreamResponse()
}
