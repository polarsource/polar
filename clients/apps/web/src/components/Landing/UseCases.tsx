'use client'

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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-y-12 py-32 md:gap-y-24">
      <div className="flex flex-col gap-y-6 px-4 md:px-0">
        <h1 className="font-display max-w-4xl text-4xl leading-snug md:text-7xl">
          Built for the shape of AI.
        </h1>
        <p className="dark:text-polar-400 max-w-2xl text-2xl text-gray-500">
          From token-metered APIs to autonomous agents and GPU workloads. Polar
          fits how modern AI products actually charge.
        </p>
      </div>

      <div className="dark:border-polar-700 dark:bg-polar-900 mx-4 flex flex-col overflow-hidden rounded-sm border border-gray-200 bg-gray-50 md:mx-0">
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
                    ? 'dark:bg-polar-950 bg-white text-gray-900 dark:text-white'
                    : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-gray-900',
                )}
              >
                {c.file}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="dark:border-polar-700 flex flex-col gap-y-6 border-b border-gray-200 p-8 md:border-r md:border-b-0">
            <span className="font-display text-3xl text-gray-900 dark:text-white">
              {active.title}
            </span>
            <span className="dark:text-polar-300 max-w-md text-xl text-gray-500">
              {active.desc}
            </span>
            <div className="mt-2">
              <Link href={active.docsHref}>
                <Button className="dark:hover:bg-polar-50 rounded-full border-none bg-black hover:bg-gray-900 dark:bg-white dark:text-black">
                  Read the docs
                </Button>
              </Link>
            </div>
          </div>

          <div className="dark:bg-polar-950 bg-white">
            <pre className="overflow-x-auto p-6 font-mono text-xs leading-relaxed text-gray-900 dark:text-gray-200">
              {active.snippet.split('\n').map((line, i) => (
                <div key={i} className="flex">
                  <span className="dark:text-polar-700 w-8 shrink-0 pr-4 text-right text-gray-300 select-none">
                    {i + 1}
                  </span>
                  <code>{line || ' '}</code>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
