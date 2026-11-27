import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import { createPolar } from '@polar-sh/sdk/2026-10'
import { after } from 'next/server'
import OpenAI from 'openai'

const polar = createPolar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })
const metering = polar.metering()

const llmIngestion = Ingestion(metering)
  .strategy(new LLMStrategy(new OpenAI()))
  .ingest('ai_usage')

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const openai = llmIngestion.client({ external_customer_id: 'user_123' })

  const response = await openai.responses.create({
    model: 'gpt-4o',
    input: prompt,
  })

  after(() => metering.flush())

  return Response.json({ text: response.output_text })
}
