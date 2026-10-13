'use client'

import { login } from './actions'
import { CodePanel } from './code-panel'
import type { HighlightedSteps } from './highlight'

const ACTIVE = { step: 'config' } as const

export function Login({ snippets }: { snippets: HighlightedSteps }) {
  return (
    <>
      <form action={login} className="card">
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          aria-label="Email"
          required
        />
        <button type="submit" className="primary">
          Continue
        </button>
      </form>
      <CodePanel snippets={snippets} active={ACTIVE} />
    </>
  )
}
