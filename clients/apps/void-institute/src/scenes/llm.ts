/**
 * The arithmetic the LLM plugin does around one model call, as
 * `plugins/llm.ts` and `plugins/llm-core.ts` implement it: four characters
 * per input token for the estimate, `maxOutputTokens` (default 4096) for the
 * output side, and in credits mode a rate per model converted and rounded up.
 */

export interface Rate {
  readonly call: number
  readonly input: number
  readonly output: number
}

export interface Tokens {
  readonly input: number
  readonly output: number
}

export const estimateInputTokens = (chars: number) =>
  Math.max(1, Math.ceil(chars / 4))

const precise = (value: number) => Number(value.toPrecision(12))

export const creditsFor = (
  rate: Rate,
  tokens: Tokens,
  round: 'up' | 'none' = 'up',
) => {
  const raw = precise(
    rate.call +
      (tokens.input * rate.input + tokens.output * rate.output) / 1000,
  )
  return round === 'none' ? raw : Math.ceil(raw)
}

/** USD list cost from per-million-token prices, what a gateway would report. */
export const listCost = (
  perMillion: { input: number; output: number },
  tokens: Tokens,
) =>
  precise(
    (tokens.input * perMillion.input + tokens.output * perMillion.output) /
      1_000_000,
  )

export interface Tier {
  readonly model: string
  readonly rate: Rate
  readonly minRemaining?: number
}

export interface TierCheck {
  readonly model: string
  readonly estimate: number
  readonly allowed: boolean
  readonly ran: boolean
}

/** The ladder: the first tier whose check allows with room to spare runs; else the last. */
export const ladder = (
  tiers: readonly Tier[],
  tokens: { input: number; maxOutput: number },
  remaining: number,
): TierCheck[] => {
  const checks = tiers.map((tier) => {
    const estimate = creditsFor(tier.rate, {
      input: tokens.input,
      output: tokens.maxOutput,
    })
    const allowed =
      estimate <= remaining && remaining - estimate >= (tier.minRemaining ?? 0)
    return { model: tier.model, estimate, allowed, ran: false }
  })
  const chosen = checks.slice(0, -1).findIndex((check) => check.allowed) ?? -1
  const index = chosen === -1 ? checks.length - 1 : chosen
  return checks.map((check, i) => ({ ...check, ran: i === index }))
}
