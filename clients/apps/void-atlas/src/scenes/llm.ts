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

/** Credits before rounding. The meter rounds up unless the rate says `none`. */
export const creditsExact = (rate: Rate, tokens: Tokens) =>
  precise(
    rate.call +
      (tokens.input * rate.input + tokens.output * rate.output) / 1000,
  )

export const creditsFor = (
  rate: Rate,
  tokens: Tokens,
  round: 'up' | 'none' = 'up',
) => {
  const raw = creditsExact(rate, tokens)
  return round === 'none' ? raw : Math.ceil(raw)
}

/** List price with the markup folded in, as a per-token meter's unit price. */
export const markedUp = (amount: number, markupPercent: number) =>
  precise(amount * (1 + markupPercent / 100))

/**
 * What `perToken` charges for one call: each token at list price times the
 * markup, summed per side. The markup lives in the meter price, not on top
 * of a later total.
 */
export const perTokenCharge = (
  prices: { readonly input: number; readonly output: number },
  tokens: Tokens,
  markupPercent: number,
) => {
  const inputPrice = markedUp(prices.input, markupPercent)
  const outputPrice = markedUp(prices.output, markupPercent)
  const input = precise(tokens.input * inputPrice)
  const output = precise(tokens.output * outputPrice)
  return {
    inputPrice,
    outputPrice,
    input,
    output,
    total: precise(input + output),
  }
}

/**
 * What `costPlus` charges: the gateway's cost times the markup factor.
 * The spend meter's usage is the raw cost; its price is the factor, so an
 * allowance of 20 covers twenty dollars of provider cost.
 */
export const costPlusCharge = (gatewayCost: number, markupPercent: number) => {
  const factor = precise(1 + markupPercent / 100)
  return { factor, total: precise(gatewayCost * factor) }
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
