import type { Lesson } from '@/lesson/types'
import { SignalLatch } from '@/scenes/SignalLatch'
import {
  compile,
  defineConfig,
  event,
  meter,
  recent,
  signal,
  sum,
  usd,
  type Config,
} from '@void/sdk/config'
import { code } from './code'

export const used = event<{ amount: number; kind: string }>('credits.used')
export const credits = meter('credits', {
  reducer: sum(used, 'amount'),
  price: usd(0),
})
export const budgetLow = signal('budget-low', {
  meter: credits,
  field: 'remaining',
  enter: { below: 100 },
  exit: { atLeast: 150 },
})
export const retryStorm = signal('retry-storm', {
  meter: credits,
  when: 'most recent spend is retries or loops, not progress',
  over: recent(1, 'hour'),
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})

export const stages: Record<'meter' | 'semantic', Config> = {
  meter: defineConfig({ schema: { used, credits, budgetLow } }),
  semantic: defineConfig({ schema: { used, credits, budgetLow, retryStorm } }),
}

const signals = compile(stages.semantic).signals!
const budgetIr = signals.find((s) => s.slug === 'budget-low')!
const stormIr = signals.find((s) => s.slug === 'retry-storm')!

/** The documented sequences: remaining balances, then Jev's nouls. */
export const BALANCES = [180, 95, 80, 110, 160]
export const NOULS = [0.5, 0.8, 0.55, 0.3]

const VOID_METER = `import { event, meter, signal, sum, usd } from '@void/sdk'

export const used = event<{ amount: number; kind: string }>('credits.used')

export const credits = meter('credits', {
  reducer: sum(used, 'amount'),
  price: usd(0),
})

export const budgetLow = signal('budget-low', {
  meter: credits,
  field: 'remaining',
  enter: { below: 100 },
  exit: { atLeast: 150 },
})
`

const GET = `const budget = client.as('acme').signals.budgetLow

const state = await budget.get()
state.status // 'inactive' | 'active' | 'unknown'
state.transition // 'entered' | 'exited' | null
state.balance?.remaining
`

const LISTEN = `const budget = client.as('acme').signals.budgetLow

const subscription = budget.listen(
  async (state) => {
    if (state.status === 'unknown') return
    await routing.setTier(state.status === 'active' ? 'economy' : 'standard')
  },
  { onRetry: (error) => console.warn('refresh failed, retrying', error) },
)

await client.as('acme').events.used.record({ amount: 30, kind: 'completion' })

// on shutdown
subscription.close()
await subscription.closed
`

const OBSERVATION = `{
  identityId: 'acme',
  signal: 'budget-low',
  status: 'active',
  transition: 'entered',
  provisional: true,
  evaluatedAt: 2026-09-21T12:00:00.000Z,
  snapshotAt: 2026-09-21T11:59:31.000Z,
  balance: { remaining: 95, limit: 'hard', reason: 'ok', period: { start, end } },
  noul: null,
  evidence: null,
}
`

const VOID_SEMANTIC = `import { event, meter, recent, signal, sum, usd } from '@void/sdk'

export const used = event<{ amount: number; kind: string }>('credits.used')

export const credits = meter('credits', {
  reducer: sum(used, 'amount'),
  price: usd(0),
})

export const budgetLow = signal('budget-low', {
  meter: credits,
  field: 'remaining',
  enter: { below: 100 },
  exit: { atLeast: 150 },
})

export const retryStorm = signal('retry-storm', {
  meter: credits,
  when: 'most recent spend is retries or loops, not progress',
  over: recent(1, 'hour'),
  enter: { above: 0.7 },
  exit: { below: 0.4 },
})
`

const JUDGE = `const storm = client.as('nightly').signals.retryStorm

const state = await storm.get()
state.noul // 0.8, Jev's answer in [0, 1]
state.evidence // what Jev saw: counts, totals, distinct values, a sample
state.status // 'active' once the noul rose above 0.7

// Every refresh asks Polar; Polar asks Jev at most once a minute per identity
// POST /v1/void/identities/nightly/judge  { signal: 'retry-storm' }
`

const JSON_IR = JSON.stringify({ signals }, null, 2)

const evidence = {
  events: 14,
  identities: 1,
  totals: { amount: 610 },
  values: { kind: ['retry', 'retry', 'completion', 'retry'] },
}

export const signalsLesson: Lesson = {
  slug: 'signals',
  title: 'Signals',
  summary: 'Conditions the SDK latches, on a balance or on a question.',
  file: 'signals.ts',
  steps: [
    {
      id: 'define',
      prose: (
        <>
          <p>
            A signal is a condition your code reacts to. A meter signal watches
            one figure of a balance and has two thresholds: it enters when{' '}
            {code('remaining')} drops below 100 and exits once it is back to at
            least 150.
          </p>
          <p>
            Two thresholds, not one. The gap between them is where a balance can
            wobble without flipping the signal back and forth.
          </p>
        </>
      ),
      code: VOID_METER,
      file: 'void.ts',
      focus: [10, 11, 12, 13, 14, 15],
      scene: <SignalLatch signal={budgetIr} values={[]} />,
    },
    {
      id: 'enter',
      prose: (
        <>
          <p>
            {code('get()')} refreshes the server baseline, merges any local
            events, and evaluates the condition on this client. Each answer is
            an observation.
          </p>
          <p>
            At 180 the signal is inactive. At 95 it crosses below the entry
            threshold and the observation carries{' '}
            {code("transition: 'entered'")}. A fresh client starts inactive;
            between the thresholds it stays wherever it was.
          </p>
        </>
      ),
      code: GET,
      focus: [3, 4, 5],
      scene: <SignalLatch signal={budgetIr} values={BALANCES.slice(0, 2)} />,
    },
    {
      id: 'hold',
      prose: (
        <>
          <p>
            Down to 80, still active. Back up to 110, still active: 110 is above
            the entry threshold but not yet at the exit threshold, so the latch
            holds. Nothing is published when nothing changed.
          </p>
          <p>
            Only at 160 does it exit. Two crossings, five readings, one
            transition each way. That is hysteresis.
          </p>
        </>
      ),
      focus: [3, 4, 5],
      scene: <SignalLatch signal={budgetIr} values={BALANCES} />,
    },
    {
      id: 'listen',
      prose: (
        <>
          <p>
            {code('listen')} keeps evaluating until closed. The handler gets the
            current state first, then every change. Usage this client records is
            applied to the balance at once; other clients&apos; usage arrives
            with the next baseline refresh, every 30 seconds by default.
          </p>
          <p>
            All signals listened to for one identity share one refresh loop.
            Callbacks are state synchronisation, not exactly-once actions; a
            handler that throws stops its listener.
          </p>
        </>
      ),
      code: LISTEN,
      focus: [3, 4, 5, 6, 7, 8, 9, 11],
      scene: (
        <SignalLatch
          signal={budgetIr}
          values={[...BALANCES, 120]}
          slots={7}
          provisional={[5]}
        />
      ),
    },
    {
      id: 'observation',
      prose: (
        <>
          <p>
            This is what a handler receives. {code('provisional')} means
            unconfirmed local events contributed to the balance;{' '}
            {code('snapshotAt')} is the age of the server baseline it was merged
            into.
          </p>
          <p>
            A balance that cannot be read, because the identity has no holder or
            the period is missing, is an {code('unknown')} observation. It keeps
            the last latched status and never emits a transition.
          </p>
        </>
      ),
      code: OBSERVATION,
      file: 'observation',
      lang: 'json',
      focus: [4, 5, 6, 8],
      scene: (
        <SignalLatch
          signal={budgetIr}
          values={[...BALANCES, 120, null]}
          slots={7}
          provisional={[5]}
        />
      ),
    },
    {
      id: 'semantic',
      prose: (
        <>
          <p>
            A semantic signal asks a question instead of reading a number. Polar
            takes the identity&apos;s events on the meter inside the window,
            summarises them, asks Jev the question verbatim, and returns a noul
            between 0 and 1.
          </p>
          <p>
            The SDK latches that the same way: in above 0.7, out below 0.4.
            Nouls 0.5, 0.8, 0.55, 0.3 give inactive, active, active, inactive.
          </p>
        </>
      ),
      code: VOID_SEMANTIC,
      file: 'void.ts',
      focus: [17, 18, 19, 20, 21, 22, 23],
      scene: <SignalLatch signal={stormIr} values={NOULS} slots={5} />,
    },
    {
      id: 'judge',
      prose: (
        <>
          <p>
            Every refresh asks Polar; Polar asks Jev only when the window
            changed, and at most once a minute per identity and question. An
            unchanged window is answered from cache, an empty window is 0
            without a call, and a fresh answer inside the minute comes back
            marked stale.
          </p>
          <p>
            A child identity is judged on its own events; a root sees its whole
            subtree. If Jev cannot be asked, the noul is null, the observation
            is unknown and the last status holds.
          </p>
        </>
      ),
      code: JUDGE,
      focus: [3, 4, 5, 6],
      scene: (
        <SignalLatch
          signal={stormIr}
          values={NOULS.slice(0, 2)}
          slots={5}
          evidence={{ ...evidence, stale: true }}
        />
      ),
    },
    {
      id: 'compiled',
      prose: (
        <>
          <p>
            Signals are part of the deployment. A meter signal&apos;s thresholds
            are stored so the dashboard can list them; the latching still
            happens on the client. A semantic signal&apos;s question and window
            are stored so Polar resolves them by slug and never trusts a prompt
            sent by a client.
          </p>
          <p>
            So changing a threshold or a question is a new version, like a
            price. The refresh interval, {code('listen')} options and your
            handlers are runtime only and change nothing.
          </p>
        </>
      ),
      code: JSON_IR,
      lang: 'json',
      file: 'void.json',
      layout: 'code',
    },
  ],
}
