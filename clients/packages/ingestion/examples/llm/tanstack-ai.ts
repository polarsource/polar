import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { after } from 'next/server'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

const llmIngestion = Ingestion(metering)
  .strategy(new LLMStrategy(openaiText('gpt-4o')))
  .ingest('ai_usage')

export async function POST(req: Request) {
  const { messages, threadId } = await req.json()

  const adapter = llmIngestion.client({ external_customer_id: 'user_123' })

  after(() => metering.flush())

  return toServerSentEventsResponse(chat({ adapter, threadId, messages }))
}
