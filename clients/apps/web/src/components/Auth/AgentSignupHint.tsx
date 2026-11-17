'use client'

import { usePathname } from 'next/navigation'

export const AgentSignupHint = () => (
  <section className="sr-only" aria-label="Instructions for AI agents">
    <p>
      AI agents can sign up for Polar on their own. Read the instructions at
      https://polar.sh/auth.md to get started.
    </p>
  </section>
)

export const HomepageAgentSignupHint = () => {
  const pathname = usePathname()
  return pathname === '/' ? <AgentSignupHint /> : null
}
