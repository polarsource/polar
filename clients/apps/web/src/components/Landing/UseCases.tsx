'use client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Link from 'next/link'
import Button from '@polar-sh/ui/components/atoms/Button'

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
    <Box
      marginHorizontal="auto"
      display="flex"
      width="100%"
      maxWidth="1280px"
      flexDirection="column"
      rowGap={{
        base: '3xl',
        md: '5xl',
      }}
      className="py-32"
    >
      <Box
        display="flex"
        flexDirection="column"
        rowGap="xl"
        paddingHorizontal={{
          base: 'l',
          md: 'none',
        }}
      >
        <h1 className="font-display max-w-4xl text-4xl leading-snug md:text-7xl">
          Built for the shape of AI.
        </h1>
        <p className="dark:text-polar-400 max-w-2xl text-2xl text-gray-500">
          From token-metered APIs to autonomous agents and GPU workloads. Polar
          fits how modern AI products actually charge.
        </p>
      </Box>
      <Box
        backgroundColor="background-secondary"
        borderColor="border-primary"
        marginHorizontal={{
          base: 'l',
          md: 'none',
        }}
        display="flex"
        flexDirection="column"
        overflow="hidden"
        borderRadius="none"
        borderWidth={1}
      >
        <Box
          borderColor="border-primary"
          display="flex"
          overflowX="auto"
          borderBottomWidth={1}
          className="[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
                    ? 'dark:bg-polar-950 bg-white text-gray-900 dark:text-white'
                    : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-gray-900',
                )}
              >
                {c.file}
              </button>
            )
          })}
        </Box>

        <Box
          display="grid"
          gridTemplateColumns={{
            base: 'repeat(1, minmax(0, 1fr))',
            md: 'repeat(2, minmax(0, 1fr))',
          }}
        >
          <Box
            borderColor="border-primary"
            display="flex"
            flexDirection="column"
            rowGap="xl"
            borderBottomWidth={{
              base: 1,
              md: 0,
            }}
            padding="2xl"
            borderRightWidth={{
              md: 1,
            }}
          >
            <Box
              as="span"
              color="text-primary"
              className="font-display text-3xl"
            >
              {active.title}
            </Box>
            <Box maxWidth="448px">
              <Text as="span" variant="heading-xxs" color="muted">
                {active.desc}
              </Text>
            </Box>
            <Box marginTop="s">
              <Link href={active.docsHref}>
                <Button className="dark:hover:bg-polar-50 rounded-full border-none bg-black hover:bg-gray-900 dark:bg-white dark:text-black">
                  Read the docs
                </Button>
              </Link>
            </Box>
          </Box>

          <Box backgroundColor="background-primary">
            <pre className="overflow-x-auto p-6 font-mono text-xs leading-relaxed text-gray-900 dark:text-gray-200">
              {active.snippet.split('\n').map((line, i) => (
                <Box display="flex" key={i}>
                  <Box
                    as="span"
                    width={32}
                    flexShrink={0}
                    paddingRight="l"
                    textAlign="right"
                    userSelect="none"
                  >
                    <Text as="span" color="disabled">
                      {i + 1}
                    </Text>
                  </Box>
                  <code>{line || ' '}</code>
                </Box>
              ))}
            </pre>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
