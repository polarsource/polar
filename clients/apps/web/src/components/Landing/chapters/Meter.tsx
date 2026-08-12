'use client'

import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { Chapter } from '../Chapter'

const CASES = [
  {
    id: 'completions',
    file: 'completions.ts',
    title: 'AI completions',
    desc: 'Wrap any model with the LLMStrategy. Tokens are metered and billed on every call.',
    docsHref:
      '/docs/features/usage-based-billing/ingestion-strategies/llm-strategy',
    snippet: `import { Ingestion } from '@polar-sh/ingestion'
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

const llm = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  .strategy(new LLMStrategy(openai('gpt-4o')))
  .ingest('openai-usage')

const { text } = await generateText({
  model: llm.client({ customerId: user.id }),
  prompt,
})`,
  },
  {
    id: 'agents',
    file: 'agents.ts',
    title: 'Autonomous agents',
    desc: 'Charge per agent run. Price success and failure differently, without double-billing.',
    docsHref: '/docs/features/usage-based-billing/event-ingestion',
    snippet: `await polar.events.ingest({
  events: [{
    name: 'agent.run.completed',
    externalCustomerId: org.id,
    metadata: {
      steps: 12,
      status: 'success',
      _llm: {
        vendor: 'anthropic',
        model: 'claude-sonnet-4',
        input_tokens: 18400,
        output_tokens: 2100,
        total_tokens: 20500,
      },
    },
  }],
})`,
  },
  {
    id: 'gpu',
    file: 'gpu.ts',
    title: 'GPU & compute',
    desc: 'Meter fine-tuning, inference and training runs by the second.',
    docsHref: '/docs/features/usage-based-billing/meters',
    snippet: `await polar.events.ingest({
  events: [{
    name: 'gpu.runtime',
    externalCustomerId: team.id,
    metadata: {
      gpu: 'a100',
      seconds: 1840,
    },
  }],
})`,
  },
]

export const Meter = () => {
  const [activeId] = useState(CASES[0].id)
  const active = CASES.find((c) => c.id === activeId) ?? CASES[0]

  return (
    <Chapter
      index="01"
      name="Meter"
      title="Every token, accounted for"
      subtitle="Usage recorded the moment it happens"
      description="Tokens, agent runs and GPU seconds, metered per customer."
    >
      <SyntaxHighlighterProvider>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
          gap={{ base: '3xl', lg: 'l' }}
        >
          <Box
            flexDirection="column"
            rowGap="l"
            minHeight={{ base: 'auto', lg: '24rem' }}
            backgroundColor="background-secondary"
            padding="2xl"
          >
            <Text variant="caption" color="muted" monospace>
              {active.file}
            </Text>
            <div className="overflow-x-auto font-mono text-xs leading-relaxed">
              <SyntaxHighlighterClient
                lang="typescript"
                code={active.snippet}
              />
            </div>
          </Box>
        </Grid>
      </SyntaxHighlighterProvider>
    </Chapter>
  )
}
