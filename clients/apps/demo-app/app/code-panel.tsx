'use client'

import { useEffect, useState } from 'react'
import type { HighlightedSteps } from './highlight'
import { STEPS, type Step } from './steps'

export type Outcomes = Partial<Record<Step, string>>

export function CodePanel({
  snippets,
  active,
  outcomes = {},
}: {
  snippets: HighlightedSteps
  // A new object re-selects the step, even after picking another one by hand
  active: { step: Step }
  outcomes?: Outcomes
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
      {outcome && (
        <footer className="outcome">
          <span>Last result</span>
          <pre key={outcome}>{outcome}</pre>
        </footer>
      )}
    </aside>
  )
}
