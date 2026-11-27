import Anthropic from '@anthropic-ai/sdk'
import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { after } from 'next/server'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

const llmIngestion = Ingestion(metering)
  .strategy(new LLMStrategy(new Anthropic()))
  .ingest('ai_usage')

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const anthropic = llmIngestion.client({ external_customer_id: 'user_123' })

  const text = await anthropic.messages
    .stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      messages: [{ role: 'user', content: prompt }],
    })
    .finalText()

  after(() => metering.flush())

  return Response.json({ text })
}
