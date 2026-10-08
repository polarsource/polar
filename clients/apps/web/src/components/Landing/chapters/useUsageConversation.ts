import { useInView } from '@/hooks/useInView'
import { useEffect, useState } from 'react'

interface Scenario {
  prompt: string
  answer: string
  tokens: number
}

const SCENARIOS: Scenario[] = [
  {
    prompt: 'Summarise the churn interviews from this quarter',
    answer:
      'Three themes came up most. Onboarding took too long, usage limits were unclear, and finance wanted invoices they could forecast.',
    tokens: 1204,
  },
  {
    prompt: 'Draft a reply to the security questionnaire',
    answer:
      'Here is a first draft. It covers data residency, encryption at rest and in transit, and how access to customer data is reviewed.',
    tokens: 2861,
  },
  {
    prompt: 'Turn these notes into a launch checklist',
    answer:
      'Done. Twelve items across product, docs and support, ordered by what blocks the announcement.',
    tokens: 947,
  },
]

export const PRICE_PER_TOKEN = 2 / 1_000_000
export const STARTING_TOKENS = 642_108_331
const EARLIER_EVENTS = [1876, 3312, 1542, 2208]
export const VISIBLE_EVENTS = EARLIER_EVENTS.length
export const PLAN_PRICE = 49

export const count = (value: number) => value.toLocaleString('en-US')
export const dollars = (value: number, digits: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`

type Phase = 'prompt' | 'streaming' | 'metered'

export const useUsageConversation = () => {
  const { ref, inView } = useInView()
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('prompt')
  const [settled, setSettled] = useState(EARLIER_EVENTS)
  const [billed, setBilled] = useState(0)
  const scenario = SCENARIOS[index]

  useEffect(() => {
    if (!inView) return
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const advance = (): [() => void, number] | null => {
      switch (phase) {
        case 'prompt':
          return reducedMotion
            ? [
                () => {
                  setTyped(scenario.answer.length)
                  setPhase('metered')
                },
                0,
              ]
            : [() => setPhase('streaming'), 900]
        case 'streaming':
          return typed < scenario.answer.length
            ? [() => setTyped((current) => current + 3), 30]
            : [() => setPhase('metered'), 250]
        case 'metered':
          return reducedMotion
            ? null
            : [
                () => {
                  setSettled((events) =>
                    [scenario.tokens, ...events].slice(0, VISIBLE_EVENTS),
                  )
                  setBilled((total) => total + scenario.tokens)
                  setIndex((current) => (current + 1) % SCENARIOS.length)
                  setTyped(0)
                  setPhase('prompt')
                },
                2600,
              ]
      }
    }

    const step = advance()
    if (!step) return
    const timer = setTimeout(step[0], step[1])
    return () => clearTimeout(timer)
  }, [inView, phase, typed, scenario])

  const progress = Math.min(typed / scenario.answer.length, 1)
  const streamed =
    phase === 'prompt' ? 0 : Math.round(scenario.tokens * progress)

  return { ref, scenario, phase, typed, streamed, settled, billed }
}
