export type Severity = 'error' | 'warning'

/**
 * Roots are paths on `globalThis` that are intercepted while the config is
 * evaluated. Every library that reads the clock, draws a random number or
 * talks to the network ends up calling one of them.
 *
 * - `Date.now`   any call of this function
 * - `Date()`     a call or `new` with no arguments only
 * - `process.env` any property read on this object
 *
 * `block` roots throw instead of running, so a config can never make the
 * request while being planned.
 */
export interface Rule {
  readonly severity: Severity
  readonly message: string
  readonly roots: ReadonlyArray<string>
  readonly block?: boolean
}

export const RULES = {
  reads_clock: {
    severity: 'error',
    message: 'Reads the clock',
    roots: ['Date()', 'Date.now', 'performance.now', 'process.hrtime'],
  },
  reads_random: {
    severity: 'error',
    message: 'Uses a random value',
    roots: ['Math.random', 'crypto.randomUUID', 'crypto.getRandomValues'],
  },
  reads_network: {
    severity: 'error',
    message: 'Makes a network request',
    roots: ['fetch', 'WebSocket', 'XMLHttpRequest'],
    block: true,
  },
  reads_environment: {
    severity: 'warning',
    message: 'Reads an environment variable',
    roots: ['process.env'],
  },
} as const satisfies Record<string, Rule>

export type RuleId = keyof typeof RULES
