'use client'

import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { SectionHeader } from './SectionHeader'
import Link from 'next/link'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const CASES = [
  {
    id: 'completions',
    file: 'completions.ts',
    title: 'AI completions',
    desc: 'Wrap any model from the Vercel AI SDK with the Polar LLMStrategy. Token usage is metered and billed automatically on every call.',
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
    desc: 'Charge per agent run with step-level granularity. Price success and failure differently, retry without double-billing, settle at end of run.',
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
    desc: 'Meter fine-tuning jobs, hosted inference, and training runs by the second. One event per job, billed at whatever rate you set.',
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

export const UseCases = () => {
  const [activeId, setActiveId] = useState(CASES[0].id)
  const active = CASES.find((c) => c.id === activeId) ?? CASES[0]

  return (
    <SyntaxHighlighterProvider>
      <Box
        display="flex"
        flexDirection="column"
        rowGap={{ base: '2xl', md: '3xl' }}
        width="100%"
      >
        <SectionHeader
          title="Turn any AI workload into revenue"
          description="From token-metered APIs to autonomous agents and GPU workloads. Polar fits how modern AI products actually charge."
        />

        <Box
          display="flex"
          flexDirection="column"
          overflow="hidden"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-secondary"
        >
          <div className="dark:border-polar-700 flex overflow-x-auto border-b border-gray-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CASES.map((c) => {
              const isActive = c.id === activeId
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={twMerge(
                    'shrink-0 border-r px-5 py-3 font-mono text-xs transition-colors',
                    'dark:border-polar-700 border-gray-200',
                    isActive
                      ? 'dark:bg-polar-800 bg-white text-gray-900 dark:text-white'
                      : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-gray-900',
                  )}
                >
                  {c.file}
                </button>
              )
            })}
          </div>

          <Box display="flex" flexDirection={{ base: 'column', md: 'row' }}>
            <Box
              display="flex"
              flexDirection="column"
              rowGap="l"
              padding="2xl"
              borderBottomWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              flex={1}
            >
              <Text variant="heading-s" as="h3" wrap="balance">
                {active.title}
              </Text>

              <Box maxWidth="28rem">
                <Text variant="heading-xxs" color="muted">
                  {active.desc}
                </Text>
              </Box>
              <Box paddingTop="xs">
                <Link href={active.docsHref}>
                  <Button className="dark:hover:bg-polar-50 rounded-full border-none bg-black hover:bg-gray-900 dark:bg-white dark:text-black">
                    Read the docs
                  </Button>
                </Link>
              </Box>
            </Box>

            <div className="dark:bg-polar-950 flex-1 overflow-x-auto bg-white p-6 font-mono text-xs leading-relaxed">
              <SyntaxHighlighterClient
                lang="typescript"
                code={active.snippet}
              />
            </div>
          </Box>
        </Box>
      </Box>
    </SyntaxHighlighterProvider>
  )
}
