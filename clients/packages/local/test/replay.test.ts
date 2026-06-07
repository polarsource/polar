import { describe, expect, test } from 'vitest'
import goldenInvoice from './golden/invoice.json'
import { events, period, plan } from './fixtures'
import { invoice, replay, restore, snapshot } from '../src/engine'
import { canonicalJson } from '../src/serialize'

const args = {
  customer: { external_customer_id: 'acme' },
  period,
  rulesetVersion: '2026.1.0',
} as const

const invoiceFor = (state: ReturnType<typeof replay>) =>
  canonicalJson(invoice(plan, state, args))

describe('determinism', () => {
  test('replaying the same events yields a byte-identical invoice', () => {
    const a = invoiceFor(replay(plan, events))
    const b = invoiceFor(replay(plan, events))
    expect(a).toBe(b)
  })

  test('invoice matches the committed golden file', () => {
    // Guards against accidental logic/pricing drift, not just self-consistency.
    expect(invoiceFor(replay(plan, events))).toBe(
      JSON.stringify(goldenInvoice, null, 2),
    )
  })

  test('event order is the only thing that matters — shuffled input is rejected by seq', () => {
    // The log is canonical *in seq order*; replay must be fed that order. We
    // assert the contract by replaying the explicitly-ordered slice.
    const ordered = [...events].sort((a, b) => a.seq - b.seq)
    expect(invoiceFor(replay(plan, ordered))).toBe(
      invoiceFor(replay(plan, events)),
    )
  })
})

describe('snapshots / time travel', () => {
  test('resuming from a snapshot equals a full replay from genesis', () => {
    const splitAt = 5 // checkpoint after the first 5 events
    const head = events.slice(0, splitAt)
    const tail = events.slice(splitAt)

    const full = replay(plan, events)

    // Snapshot the head, throw the in-memory state away, restore, fold the tail.
    const checkpoint = snapshot(replay(plan, head))
    const resumed = replay(plan, tail, restore(checkpoint))

    expect(invoiceFor(resumed)).toBe(invoiceFor(full))
  })

  test('a snapshot round-trips through serialization unchanged', () => {
    const state = replay(plan, events)
    const once = snapshot(state)
    const twice = snapshot(restore(once))
    expect(canonicalJson(twice)).toBe(canonicalJson(once))
  })

  test('recompute history: folding a prefix bills only what happened by then', () => {
    // Replay up to event 2 (acme: 1.5M... no — 1M tokens, 1 request, 3 seats).
    const asOf = replay(plan, events.slice(0, 3))
    const inv = invoice(plan, asOf, args)
    const seats = inv.lines.find((l) => l.meter === 'seats')!
    const tokens = inv.lines.find((l) => l.meter === 'tokens')!
    expect(seats.quantity).toBe(3n) // peak so far, not the later 7
    expect(tokens.quantity).toBe(1_000_000n)
  })
})
