import { compile } from '@void/sdk/config'
import { describe, expect, it } from 'vitest'
import { chain, check, features, subtreeUsage } from '@/scenes/tree'
import { config, identitiesLesson, trees } from './identities'

describe('identities chapter', () => {
  it('deploys the feature and the terms the tree reads', () => {
    const ir = compile(config)
    expect(ir.entitlements.map((e) => e.slug)).toEqual(['priority'])
    expect(ir.products[0]).toMatchObject({
      entitlements: ['priority'],
      meters: [{ slug: 'bandwidth', included: 1_000_000, limit: 'hard' }],
    })
  })

  it('folds usage into every ancestor', () => {
    const tree = trees.recorded!
    expect(chain(tree, 'nightly')).toEqual(['nightly', 'alice', 'acme'])
    expect(subtreeUsage(tree, 'nightly')).toBe(108_211)
    expect(subtreeUsage(tree, 'alice')).toBe(108_211)
    expect(subtreeUsage(tree, 'acme')).toBe(488_211)
  })

  it('lets the tightest holder up the chain answer a check', () => {
    expect(check(trees.recorded!, 'nightly', 50_000)).toMatchObject({
      allowed: true,
      limitedBy: 'acme',
      remaining: 511_789,
    })
    expect(check(trees.capped!, 'nightly', 50_000)).toMatchObject({
      allowed: false,
      limitedBy: 'alice',
      remaining: 41_789,
      reason: 'cap',
    })
  })

  it('narrows features down the tree and never up', () => {
    const tree = trees.batch!
    expect(features(tree, 'nightly')).toEqual(['priority'])
    expect(features(tree, 'bob')).toEqual([])
    expect(features(tree, 'batch')).toEqual([])
    expect(check(tree, 'batch', 25_000)).toMatchObject({
      allowed: false,
      limitedBy: 'batch',
    })
  })

  it('shows the config first, then one growing identities file', () => {
    const files = identitiesLesson.steps.map(
      (step) => step.file ?? identitiesLesson.file,
    )
    expect(files[0]).toBe('void.ts')
    expect(new Set(files.slice(1))).toEqual(new Set(['identities.ts']))
  })
})
