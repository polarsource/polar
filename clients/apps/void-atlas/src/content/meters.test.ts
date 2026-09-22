import { compile } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { check, standing } from '@/scenes/balance'
import { metersLesson, stages } from './meters'

describe('meters chapter', () => {
  const bandwidth = compile(stages.meter).meters[0]!
  const hard = compile(stages.hard).products[0]!.meters[0]!
  const soft = compile(stages.soft).products[0]!.meters[0]!

  it('compiles the terms the prose describes', () => {
    expect(bandwidth).toMatchObject({
      slug: 'bandwidth',
      unit_amount: 0.00000008,
    })
    expect(compile(stages.payPerUse).products[0]!.meters[0]).toMatchObject({
      included: 0,
      limit: 'soft',
    })
    expect(hard).toMatchObject({ included: 1_000_000, limit: 'hard' })
    expect(soft).toMatchObject({ included: 1_000_000, limit: 'soft' })
  })

  it('links the wallet meter to its granted reducer', () => {
    const wallet = compile(stages.wallet).meters.find(
      (m) => m.slug === 'wallet',
    )
    expect(wallet).toMatchObject({
      reducer: 'wallet',
      credit_reducer: 'wallet-granted',
    })
  })

  it('answers no_plan without a holder', () => {
    expect(standing({ kind: 'none' }, 522_131).reason).toBe('no_plan')
    expect(check(bandwidth, { kind: 'none' }, 522_131, 600_000)).toMatchObject({
      allowed: false,
      reason: 'no_plan',
    })
  })

  it('denies past a hard limit and bills past a soft one', () => {
    const holder = (term: typeof hard) =>
      ({ kind: 'subscription', id: 'acme', term }) as const
    expect(check(bandwidth, holder(hard), 522_131, 600_000)).toMatchObject({
      allowed: false,
      reason: 'cap',
      remaining: 477_869,
      limitedBy: 'acme',
    })
    const billed = check(bandwidth, holder(soft), 522_131, 600_000)
    expect(billed).toMatchObject({
      allowed: true,
      reason: 'ok',
      overageAfter: 122_131,
    })
    expect(billed.overageCost).toBeCloseTo(122_131 * 0.00000008, 10)
  })

  it('runs prepaid credits dry like a hard limit', () => {
    const wallet = compile(stages.wallet).meters.find(
      (m) => m.slug === 'wallet',
    )!
    const holder = { kind: 'credits', id: 'acme', granted: 1_000 } as const
    expect(standing(holder, 640).remaining).toBe(360)
    expect(check(wallet, holder, 640, 500).allowed).toBe(false)
  })

  it('ends on the compiled meters and products', () => {
    const last = metersLesson.steps.at(-1)!
    const parsed = JSON.parse(last.code!) as {
      meters: { slug: string }[]
      products: { slug: string }[]
    }
    expect(parsed.meters.map((m) => m.slug)).toEqual(['bandwidth', 'wallet'])
    expect(parsed.products.map((p) => p.slug)).toEqual(['pro'])
  })
})
