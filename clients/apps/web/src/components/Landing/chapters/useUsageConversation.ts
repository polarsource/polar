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
/** The bill starts empty and fills in as the conversation runs. */
const NO_EVENTS: UsageEvent[] = []
export const VISIBLE_EVENTS = 3
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

/** The prologue: Claude is asked to build the app and wire up Polar before the app runs. */
export const TERMINAL_COMMAND = 'Build a chatbot and hook up Polar for billing'
export const TERMINAL_STEPS = [
  'Created app/chat.tsx with a streaming assistant',
  'Installed @polar-sh/sdk and added polar.config.ts',
  'Metering tokens.in, tokens.out and tool.call per customer',
  'Done. Start the app and send a prompt.',
]
export type Stage = 'terminal' | 'signin' | 'upgrade' | 'app'
const SIGNIN_EMAIL = 'billing@acme.com'

/** The prompt is typed into the composer, sent, answered, and the answer is metered. */
type Phase = 'typing' | 'working' | 'streaming' | 'metered'

export const useUsageConversation = () => {
  const { ref, inView } = useInView()
  const [index, setIndex] = useState(0)
  const [typedPrompt, setTypedPrompt] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const [settled, setSettled] = useState(NO_EVENTS)
  const [billedIn, setBilledIn] = useState(0)
  const [billedOut, setBilledOut] = useState(0)
  const [billedToolCalls, setBilledToolCalls] = useState(0)
  const [firstPrompt, setFirstPrompt] = useState(true)
  const [stage, setStage] = useState<Stage>('terminal')
  const [typedCommand, setTypedCommand] = useState(0)
  const [commandTyped, setCommandTyped] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [upgraded, setUpgraded] = useState(false)
  const [typedEmail, setTypedEmail] = useState(0)
  const [stepsShown, setStepsShown] = useState(0)
  const scenario = SCENARIOS[index]

  const record = (event: UsageEvent) =>
    setSettled((events) => [event, ...events].slice(0, VISIBLE_EVENTS))

  useEffect(() => {
    if (!inView || stage !== 'terminal') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const skip = window.setTimeout(() => setStage('app'), 0)
      return () => clearTimeout(skip)
    }
    let frame = 0
    let timer = 0
    if (!commandTyped) {
      // The command is typed after a beat, one character per frame against the clock.
      timer = window.setTimeout(() => {
        let started = 0
        const tick = (now: number) => {
          if (!started) started = now
          const shown = Math.min(
            TERMINAL_COMMAND.length,
            Math.floor(((now - started) / 1000) * 28),
          )
          setTypedCommand(shown)
          if (shown < TERMINAL_COMMAND.length)
            frame = requestAnimationFrame(tick)
          else timer = window.setTimeout(() => setCommandTyped(true), 900)
        }
        frame = requestAnimationFrame(tick)
      }, 1000)
    } else if (stepsShown < TERMINAL_STEPS.length) {
      timer = window.setTimeout(() => setStepsShown((count) => count + 1), 700)
    } else {
      timer = window.setTimeout(() => setStage('signin'), 1400)
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [inView, stage, commandTyped, stepsShown])

  useEffect(() => {
    if (!inView || stage !== 'signin') return
    let frame = 0
    let timer = 0
    if (!signedIn) {
      // The email is typed after a beat, then the form submits.
      timer = window.setTimeout(() => {
        let started = 0
        const tick = (now: number) => {
          if (!started) started = now
          const shown = Math.min(
            SIGNIN_EMAIL.length,
            Math.floor(((now - started) / 1000) * 28),
          )
          setTypedEmail(shown)
          if (shown < SIGNIN_EMAIL.length) frame = requestAnimationFrame(tick)
          else timer = window.setTimeout(() => setSignedIn(true), 500)
        }
        frame = requestAnimationFrame(tick)
      }, 700)
    } else timer = window.setTimeout(() => setStage('upgrade'), 900)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [inView, stage, signedIn])

  // The upgrade: the Pro plan is shown, chosen after a beat, and the app opens once it is paid.
  useEffect(() => {
    if (!inView || stage !== 'upgrade') return
    const timer = window.setTimeout(
      () => (upgraded ? setStage('app') : setUpgraded(true)),
      upgraded ? 1100 : 1800,
    )
    return () => clearTimeout(timer)
  }, [inView, stage, upgraded])

  useEffect(() => {
    if (!inView || stage !== 'app') return
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

    // Characters are revealed one at a time against the clock, so the pace is steady at any frame rate.
    const reveal = (
      text: string,
      perSecond: number,
      set: (n: number) => void,
      done: () => void,
      pause: number,
    ) => {
      // The clock starts on the first painted frame, so a delayed first frame never skips characters.
      let started = 0
      const tick = (now: number) => {
        if (!started) started = now
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
      case 'typing': {
        const type = () =>
          reveal(scenario.prompt, 28, setTypedPrompt, send, 600)
        // The first prompt waits a moment, so the empty bill is seen before it fills.
        // Clearing the flag re-runs this effect, which then starts the typing.
        if (firstPrompt)
          timer = window.setTimeout(() => setFirstPrompt(false), 1000)
        else type()
        break
      }
      case 'working':
        timer = window.setTimeout(answer, 1600)
        break
      case 'streaming':
        reveal(scenario.answer, 70, setTyped, () => setPhase('metered'), 250)
        break
      case 'metered':
        timer = window.setTimeout(settle, 2600)
        break
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [inView, stage, phase, scenario, firstPrompt])

  const progress = Math.min(typed / scenario.answer.length, 1)
  const streamed =
    phase === 'streaming' || phase === 'metered'
      ? Math.round(scenario.outputTokens * progress)
      : 0
  const inputCharge = billedIn * PRICES['tokens.in']
  const outputCharge = billedOut * PRICES['tokens.out']

  return {
    ref,
    scenario,
    phase,
    stage,
    /** True once the terminal command has been sent to Claude. */
    commandSent: commandTyped,
    /** How much of Polar is set up: 1 the product, 2 the meters, 3 the customer. Grows with the terminal steps. */
    setupLevel: upgraded ? 5 : signedIn ? 4 : Math.min(3, stepsShown),
    signedIn,
    upgraded,
    /** The email as far as it has been typed into the sign-in form. */
    typedEmail: SIGNIN_EMAIL.slice(0, typedEmail),
    /** The terminal command as far as it has been typed. */
    terminalCommand: TERMINAL_COMMAND.slice(0, typedCommand),
    terminalDone: typedCommand >= TERMINAL_COMMAND.length,
    terminalSteps: TERMINAL_STEPS.slice(0, stepsShown),
    /** True until the first prompt has been sent. */
    firstPrompt,
    /** The prompt as far as it has been typed into the composer. */
    composerText:
      phase === 'typing' ? scenario.prompt.slice(0, typedPrompt) : '',
    /** The answer as far as it has streamed. */
    typed,
    /** Output tokens of the answer so far, still being metered. */
    streamed,
    settled,
    totalTokens: billedIn + billedOut + streamed,
    creditsLeft: CREDITS_GRANTED - billedToolCalls * CREDITS_PER_TOOL_CALL,
    inputCharge,
    outputCharge,
    /** Changes whenever usage settles onto the bill, so the charge can react. */
    billed: billedIn + billedOut + billedToolCalls,
  }
}
