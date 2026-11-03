'use client'

import { useEffect, useState } from 'react'
import { getOutpost, type getBalance } from './actions'
import type { HighlightedSteps } from './highlight'
import { STEPS, type Step } from './steps'

export type Outcomes = Partial<Record<Step, string>>

export type OutpostRead = Awaited<ReturnType<typeof getBalance>>

const plural = (count: number, word: string) =>
  `${count} ${count === 1 ? word : `${word}s`}`

const time = new Intl.DateTimeFormat('en', { timeStyle: 'medium' })

// `null` until the first balance read
function OutpostStatus({ read }: { read: OutpostRead | null }) {
  const [now, setNow] = useState(() => Date.now())
  const [state, setState] = useState(read?.outpost)

  useEffect(() => setState(read?.outpost), [read])

  // Polls Redis so pending events can be seen settling without a balance read
  useEffect(() => {
    if (!read?.outpost) return
    const interval = setInterval(async () => {
      setNow(Date.now())
      setState(await getOutpost())
    }, 5000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(interval)
      clearInterval(tick)
    }
  }, [read])

  return (
    <section className="outpost">
      <header>
        <span>Outpost</span>
        <span className={state ? 'outpost-on' : 'faint'}>
          {read === null ? '…' : state ? '● on' : '○ off'}
        </span>
      </header>
      {read && (
        <dl>
          <dt>Balance read</dt>
          <dd>{read.readMs.toFixed(0)} ms</dd>
          {state && (
            <>
              <dt>Credited</dt>
              <dd>{state.credits}</dd>
              <dt>Settled by Polar</dt>
              <dd>−{plural(state.settled, 'event')}</dd>
              <dt>
                Pending locally
                {state.pending > 0 && (
                  <span className="faint">
                    {' '}
                    · settles after {time.format(state.pendingUntil)}
                  </span>
                )}
              </dt>
              <dd>−{plural(state.pending, 'event')}</dd>
              <dt>Balance</dt>
              <dd className="outpost-total">
                {state.credits - state.settled - state.pending}
              </dd>
              <dt>Snapshot age</dt>
              <dd>
                {Math.max(0, Math.round((now - state.snapshotAt) / 1000))} s
              </dd>
            </>
          )}
        </dl>
      )}
    </section>
  )
}

export function CodePanel({
  snippets,
  active,
  outcomes = {},
  outpost,
}: {
  snippets: HighlightedSteps
  // A new object re-selects the step, even after picking another one by hand
  active: { step: Step }
  outcomes?: Outcomes
  // Omitted on the login screen, which has no customer yet
  outpost?: OutpostRead | null
}) {
  const [selected, setSelected] = useState(active.step)

  useEffect(() => setSelected(active.step), [active])

  const step = STEPS.find(({ id }) => id === selected) ?? STEPS[0]
  const outcome = outcomes[step.id]

  return (
    <aside className="panel">
      <nav className="steps">
        {STEPS.map(({ id, label }) => (
          <button
            key={id}
            className="step"
            aria-current={id === step.id ? 'step' : undefined}
            onClick={() => setSelected(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div key={step.id} className="panel-body">
        <header className="panel-header">
          <h2>{step.title}</h2>
          <p className="text-pretty">{step.description}</p>
        </header>
        {snippets[step.id].map(({ name, html }) => (
          <figure key={name} className="file">
            <figcaption>{name}</figcaption>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </figure>
        ))}
      </div>
      {outpost !== undefined && <OutpostStatus read={outpost} />}
      {outcome && (
        <footer className="outcome">
          <span>Last result</span>
          <pre key={outcome}>{outcome}</pre>
        </footer>
      )}
    </aside>
  )
}
