import { useInView } from '@/hooks/useInView'
import { useEffect, useState } from 'react'

interface Scenario {
  prompt: string
  answer: string
  inputTokens: number
  outputTokens: number
  /** Tool calls the assistant makes before it answers. */
  tools: number
  /** What the assistant says it is doing while the tools run. */
  working: string
}

const SCENARIOS: Scenario[] = [
  {
    prompt: 'Summarise the churn interviews',
    answer:
      'Three themes came up most. Onboarding took too long, usage limits were unclear, and finance wanted invoices they could forecast.',
    inputTokens: 3418,
    outputTokens: 1204,
    tools: 2,
    working: 'Reading 14 interview transcripts',
  },
  {
    prompt: 'Reply to the security questionnaire',
    answer:
      'Here is a first draft. It covers data residency, encryption at rest and in transit, and how access to customer data is reviewed.',
    inputTokens: 5126,
    outputTokens: 2861,
    tools: 1,
    working: 'Checking the security policy',
  },
  {
    prompt: 'Turn these notes into a launch checklist',
    answer:
      'Done. Twelve items across product, docs and support, ordered by what blocks the announcement.',
    inputTokens: 2240,
    outputTokens: 947,
    tools: 3,
    working: 'Reading notes and the roadmap',
  },
]

export type UsageEventName = 'tokens.in' | 'tokens.out' | 'tool.call'

export interface UsageEvent {
  name: UsageEventName
  quantity: number
}

const PRICES: Record<UsageEventName, number> = {
  'tokens.in': 0.5 / 1_000_000,
  'tokens.out': 2 / 1_000_000,
  // Tool calls are prepaid: they draw down the plan's credits instead of billing.
  'tool.call': 0,
}
export const CREDITS_PER_TOOL_CALL = 10
export const CREDITS_GRANTED = 5_000
export const STARTING_TOKENS_IN = 418_206_117
export const STARTING_TOKENS_OUT = 223_902_214
const STARTING_TOOL_CALLS = 86
const EARLIER_EVENTS: UsageEvent[] = [
  { name: 'tokens.out', quantity: 1876 },
  { name: 'tool.call', quantity: 2 },
  { name: 'tokens.in', quantity: 4312 },
]
export const VISIBLE_EVENTS = EARLIER_EVENTS.length
export const PLAN_PRICE = 49

export const chargeFor = ({ name, quantity }: UsageEvent) =>
  quantity * PRICES[name]
export const creditsFor = ({ quantity }: UsageEvent) =>
  quantity * CREDITS_PER_TOOL_CALL

export const count = (value: number) => value.toLocaleString('en-US')
export const dollars = (value: number, digits: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`

/** The prompt is typed into the composer, sent, answered, and the answer is metered. */
type Phase = 'typing' | 'working' | 'streaming' | 'metered'

export const useUsageConversation = () => {
  const { ref, inView } = useInView()
  const [index, setIndex] = useState(0)
  const [typedPrompt, setTypedPrompt] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const [settled, setSettled] = useState(EARLIER_EVENTS)
  const [billedIn, setBilledIn] = useState(0)
  const [billedOut, setBilledOut] = useState(0)
  const [billedToolCalls, setBilledToolCalls] = useState(0)
  const scenario = SCENARIOS[index]

  const record = (event: UsageEvent) =>
    setSettled((events) => [event, ...events].slice(0, VISIBLE_EVENTS))

  useEffect(() => {
    if (!inView) return
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    // Sending meters the prompt. Then the tools run, and their calls settle as the answer starts to stream.
    const send = () => {
      record({ name: 'tokens.in', quantity: scenario.inputTokens })
      setBilledIn((total) => total + scenario.inputTokens)
      setPhase('working')
    }
    const answer = () => {
      if (scenario.tools > 0) {
        record({ name: 'tool.call', quantity: scenario.tools })
        setBilledToolCalls((total) => total + scenario.tools)
      }
      setPhase('streaming')
    }
    const settle = () => {
      record({ name: 'tokens.out', quantity: scenario.outputTokens })
      setBilledOut((total) => total + scenario.outputTokens)
      setIndex((current) => (current + 1) % SCENARIOS.length)
      setTypedPrompt(0)
      setTyped(0)
      setPhase('typing')
    }

    let frame = 0
    let timer = 0
    if (reducedMotion) {
      if (phase === 'typing')
        timer = window.setTimeout(() => {
          setTypedPrompt(scenario.prompt.length)
          setTyped(scenario.answer.length)
          setPhase('metered')
        }, 0)
      return () => clearTimeout(timer)
    }

    const started = performance.now()
    // Characters are revealed one at a time against the clock, so the pace is steady at any frame rate.
    const reveal = (
      text: string,
      perSecond: number,
      set: (n: number) => void,
      done: () => void,
      pause: number,
    ) => {
      const tick = (now: number) => {
        const shown = Math.min(
          text.length,
          Math.floor(((now - started) / 1000) * perSecond),
        )
        set(shown)
        if (shown < text.length) frame = requestAnimationFrame(tick)
        else timer = window.setTimeout(done, pause)
      }
      frame = requestAnimationFrame(tick)
    }

    switch (phase) {
      case 'typing':
        reveal(scenario.prompt, 48, setTypedPrompt, send, 600)
        break
      case 'working':
        timer = window.setTimeout(answer, 1600)
        break
      case 'streaming':
        reveal(scenario.answer, 110, setTyped, () => setPhase('metered'), 250)
        break
      case 'metered':
        timer = window.setTimeout(settle, 2600)
        break
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [inView, phase, scenario])

  const progress = Math.min(typed / scenario.answer.length, 1)
  const streamed =
    phase === 'streaming' || phase === 'metered'
      ? Math.round(scenario.outputTokens * progress)
      : 0
  const inputCharge = (STARTING_TOKENS_IN + billedIn) * PRICES['tokens.in']
  const outputCharge = (STARTING_TOKENS_OUT + billedOut) * PRICES['tokens.out']

  return {
    ref,
    scenario,
    phase,
    /** The prompt as far as it has been typed into the composer. */
    composerText:
      phase === 'typing' ? scenario.prompt.slice(0, typedPrompt) : '',
    /** The answer as far as it has streamed. */
    typed,
    /** Output tokens of the answer so far, still being metered. */
    streamed,
    /** Input tokens of the prompt as far as it has been typed. */
    promptTokens: Math.round(
      (scenario.inputTokens * typedPrompt) / scenario.prompt.length,
    ),
    settled,
    totalTokens:
      STARTING_TOKENS_IN +
      STARTING_TOKENS_OUT +
      billedIn +
      billedOut +
      streamed,
    creditsLeft:
      CREDITS_GRANTED -
      (STARTING_TOOL_CALLS + billedToolCalls) * CREDITS_PER_TOOL_CALL,
    inputCharge,
    outputCharge,
    /** Changes whenever usage settles onto the bill, so the charge can react. */
    billed: billedIn + billedOut + billedToolCalls,
  }
}
