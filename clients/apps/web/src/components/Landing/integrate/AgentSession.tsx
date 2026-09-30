'use client'

import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Shimmer } from '../Shimmer'

interface Scenario {
  client: string
  prompt: string
  steps: [string, string, string]
  reply: string
}

const SCENARIOS: Scenario[] = [
  {
    client: 'Claude Code',
    prompt: 'Which customers ran out of credits this week?',
    steps: [
      'search_tools  "customers with a negative credit balance"',
      'describe_tools  list_customer_meters',
      'execute_tool  list_customer_meters  balance < 0',
    ],
    reply:
      'Three customers crossed zero: Atlas, Northwind and Lumen. Want me to grant a top-up or send each of them a checkout link?',
  },
  {
    client: 'Cursor',
    prompt: 'Send Atlas a checkout link for the 50k credit pack.',
    steps: [
      'search_tools  "create a checkout link"',
      'describe_tools  create_checkout_link',
      'execute_tool  create_checkout_link  product=credits_50k',
    ],
    reply:
      'Done. The link is buy.polar.sh/atlas-50k and I attached it to the customer note.',
  },
  {
    client: 'ChatGPT',
    prompt: 'How did MRR move in September?',
    steps: [
      'search_tools  "revenue metrics by month"',
      'describe_tools  get_metrics',
      'execute_tool  get_metrics  interval=month',
    ],
    reply:
      'MRR grew 12% to $48,200. Fourteen new subscriptions, two churned, and usage revenue is now a third of the total.',
  },
]

type Phase = 'enter' | 'typing' | 'step' | 'reply' | 'exit'

const DURATIONS = {
  enter: 700,
  typing: 28,
  step: 900,
  reply: 3600,
  exit: 500,
}

export const AgentSession = () => {
  const { ref, inView } = useInView()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('enter')
  const [typed, setTyped] = useState(0)
  const [step, setStep] = useState(0)
  const scenario = SCENARIOS[index]

  useEffect(() => {
    if (!inView) return

    const advance = (): [() => void, number] => {
      switch (phase) {
        case 'enter':
          return [() => setPhase('typing'), DURATIONS.enter]
        case 'typing':
          return typed < scenario.prompt.length
            ? [() => setTyped((n) => n + 1), DURATIONS.typing]
            : [() => setPhase('step'), 400]
        case 'step':
          return step < scenario.steps.length
            ? [() => setStep((n) => n + 1), DURATIONS.step]
            : [() => setPhase('reply'), 200]
        case 'reply':
          return [() => setPhase('exit'), DURATIONS.reply]
        case 'exit':
          return [
            () => {
              setIndex((i) => (i + 1) % SCENARIOS.length)
              setTyped(0)
              setStep(0)
              setPhase('enter')
            },
            DURATIONS.exit,
          ]
      }
    }

    const [next, delay] = advance()
    const timer = setTimeout(next, delay)
    return () => clearTimeout(timer)
  }, [inView, phase, typed, step, scenario])

  return (
    <Box
      ref={ref}
      width="100%"
      maxWidth="38rem"
      padding={{ base: 'l', md: 'xl' }}
      backgroundColor="background-primary"
      boxShadow="l"
    >
      <Box
        width="100%"
        flexDirection="column"
        rowGap="m"
        opacity={phase === 'exit' ? 0 : 1}
        transitionProperty="opacity"
        transitionDuration="slower"
      >
        <Box
          flexDirection="column"
          rowGap="s"
          padding="l"
          backgroundColor="background-card"
          boxShadow="m"
        >
          <Box alignItems="center" columnGap="s">
            <Box
              width={20}
              height={20}
              alignItems="center"
              justifyContent="center"
              backgroundColor="background-secondary"
            >
              <Text variant="caption">M</Text>
            </Box>
            <Text variant="caption" color="muted">
              Mia in {scenario.client}
            </Text>
          </Box>
          <Box minHeight={20}>
            <Text variant="default">
              {scenario.prompt.slice(0, typed)}
              {phase === 'typing' ? '▍' : ''}
            </Text>
          </Box>
        </Box>
        <Box flexDirection="column" rowGap="s" paddingHorizontal="l">
          {scenario.steps.map((line, i) => {
            const started = phase !== 'enter' && phase !== 'typing' && step >= i
            const done = step > i
            return (
              <Box
                key={line}
                alignItems="center"
                columnGap="s"
                color={done ? 'text-primary' : 'text-secondary'}
                opacity={started ? 1 : 0}
                transitionProperty="opacity"
                transitionDuration="slow"
              >
                {done ? (
                  <Check size={12} />
                ) : (
                  <LoaderCircle size={12} className="animate-spin" />
                )}
                <Text variant="caption" color="muted" monospace wrap="wrap">
                  <Shimmer active={started && !done}>{line}</Shimmer>
                </Text>
              </Box>
            )
          })}
        </Box>
        <Box
          minHeight="3.5rem"
          paddingHorizontal="l"
          opacity={phase === 'reply' ? 1 : 0}
          transitionProperty="opacity"
          transitionDuration="slow"
        >
          <Text variant="default" as="p" color="muted" wrap="pretty">
            {scenario.reply}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
