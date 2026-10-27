'use client'

import { useInView } from '@/hooks/useInView'
import { Check, LoaderCircle } from '@polar-sh/orbit/icons'
import { useEffect, useState } from 'react'
import { Shimmer } from '../Shimmer'

/** The prompts the session rotates through: what a coding agent does with Polar's MCP server and skills. */
const TURNS = [
  {
    prompt: 'Implement Polar for billing in my app',
    running: 'Adding checkout, customer portal and webhooks',
    done: 'Edited 3 files',
    result: 'Checkout, the customer portal and verified webhooks are wired in.',
  },
  {
    prompt: 'Meter every model call with Polar',
    running: 'Wrapping the model with Polar ingestion',
    done: 'Edited 2 files',
    result: 'Every model call now sends its token usage to Polar.',
  },
  {
    prompt: 'Add a Pro plan with 10,000 credits a month',
    running: 'Creating the product in Polar',
    done: 'Created Pro',
    result: 'Pro is live at $49 a month and grants 10,000 credits each cycle.',
  },
  {
    prompt: 'Only let paying customers export reports',
    running: 'Checking customer state before export',
    done: 'Edited 1 file',
    result: 'Exports now check the customer has an active subscription.',
  },
]

type Phase = 'enter' | 'typing' | 'running' | 'done' | 'exit'

const DURATIONS = {
  enter: 1000,
  typing: 22,
  running: 1600,
  done: 3600,
  exit: 500,
}

/** A coding agent working with Polar, in the terminal style of the landing's Agents figure. Loops. */
export const McpSession = () => {
  const { ref, inView } = useInView()
  const [turn, setTurn] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('enter')
  const { prompt, running, done, result } = TURNS[turn]

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const still = window.setTimeout(() => {
        setTyped(prompt.length)
        setPhase('done')
      }, 0)
      return () => clearTimeout(still)
    }

    const advance = (): [() => void, number] => {
      switch (phase) {
        case 'enter':
          return [() => setPhase('typing'), DURATIONS.enter]
        case 'typing':
          return typed < prompt.length
            ? [() => setTyped((n) => n + 1), DURATIONS.typing]
            : [() => setPhase('running'), 300]
        case 'running':
          return [() => setPhase('done'), DURATIONS.running]
        case 'done':
          return [() => setPhase('exit'), DURATIONS.done]
        case 'exit':
          return [
            () => {
              setTurn((t) => (t + 1) % TURNS.length)
              setTyped(0)
              setPhase('enter')
            },
            DURATIONS.exit,
          ]
      }
    }

    const [next, delay] = advance()
    const timer = setTimeout(next, delay)
    return () => clearTimeout(timer)
  }, [inView, phase, typed, prompt])

  const settled = phase === 'running' || phase === 'done'

  return (
    <div
      ref={ref}
      className={`flex h-full min-w-0 flex-col gap-1 font-mono text-[13px] leading-6 transition-opacity duration-500 ${phase === 'exit' ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="border-polar-700 mb-4 flex flex-col self-start rounded-md border px-3 py-1">
        <span className="text-white">
          <span className="text-polar-300">✻ </span>Claude Code
        </span>
        <span className="text-polar-500">~/acme · Polar MCP connected</span>
      </div>
      <div className="whitespace-pre-wrap text-white">
        <span className="text-polar-500">{'> '}</span>
        {prompt.slice(0, typed)}
        {phase === 'enter' || phase === 'typing' ? (
          <span
            className={`ml-px inline-block h-[1em] w-[0.55em] translate-y-[0.15em] bg-white/80 ${phase === 'enter' ? 'animate-pulse' : ''}`}
          />
        ) : null}
      </div>
      {settled ? (
        <div className="text-polar-500 mt-2 flex [animation:appear_300ms_ease-out_both] items-center gap-2">
          {phase === 'done' ? (
            <Check size={12} className="shrink-0" />
          ) : (
            <LoaderCircle size={12} className="shrink-0 animate-spin" />
          )}
          <Shimmer active={phase === 'running'}>
            {phase === 'done' ? done : running}
          </Shimmer>
        </div>
      ) : null}
      {phase === 'done' ? (
        <div className="text-polar-300 [animation:appear_360ms_ease-out_both] whitespace-pre-wrap">
          {result}
        </div>
      ) : null}
    </div>
  )
}
