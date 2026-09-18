import { describe, expect, it } from 'vitest'
import {
  autoExpandedIdentityIds,
  buildTree,
  identityMatches,
  visibleIdentityForest,
} from './identities'

const row = (
  id: string,
  parent_id: string | null,
  name: string,
  kind: string,
  created_at: string,
) => ({ id, parent_id, name, kind, created_at })

const sable = row('sable', null, 'Sable Systems', 'customer', '2026-03-01')
const support = row('support', 'sable', 'support-agent', 'agent', '2026-03-02')
const deploy = row('deploy', 'sable', 'deploy-bot', 'agent', '2026-03-03')
const orbital = row('orbital', null, 'Orbital Foods', 'customer', '2026-04-01')
const nightly = row(
  'nightly',
  'orbital',
  'nightly-indexer',
  'service',
  '2026-04-02',
)
const review = row('review', 'support', 'review-bot', 'agent', '2026-03-04')

describe('identityMatches', () => {
  it('treats customer as roots', () => {
    expect(identityMatches(sable, 'customer', '')).toBe(true)
    expect(identityMatches(support, 'customer', '')).toBe(false)
  })

  it('matches kind and search together', () => {
    expect(identityMatches(support, 'agent', 'support')).toBe(true)
    expect(identityMatches(support, 'agent', 'deploy')).toBe(false)
    expect(identityMatches(deploy, 'service', '')).toBe(false)
  })
})

describe('visibleIdentityForest', () => {
  const tree = buildTree([sable, support, deploy, orbital, nightly, review])

  it('keeps children colocated under their parent', () => {
    const forest = visibleIdentityForest(tree, 'all', '', 'newest')
    expect(forest.map((node) => node.identity.id)).toEqual(['orbital', 'sable'])
    const sableNode = forest[1]
    expect(sableNode.depth).toBe(0)
    expect(sableNode.children.map((node) => node.identity.id)).toEqual([
      'deploy',
      'support',
    ])
    expect(sableNode.children[1].depth).toBe(1)
    expect(
      sableNode.children[1].children.map((node) => node.identity.id),
    ).toEqual(['review'])
    expect(sableNode.children[1].children[0].depth).toBe(2)
  })

  it('keeps the parent when a nested identity matches search', () => {
    const forest = visibleIdentityForest(tree, 'all', 'review', 'newest')
    expect(forest.map((node) => node.identity.id)).toEqual(['sable'])
    expect(forest[0].children.map((node) => node.identity.id)).toEqual([
      'support',
    ])
    expect(
      forest[0].children[0].children.map((node) => node.identity.id),
    ).toEqual(['review'])
  })

  it('filters agents without dropping their customer', () => {
    const forest = visibleIdentityForest(tree, 'agent', '', 'oldest')
    expect(forest.map((node) => node.identity.id)).toEqual(['sable'])
    expect(forest[0].children.map((node) => node.identity.kind)).toEqual([
      'agent',
      'agent',
    ])
  })
})

describe('autoExpandedIdentityIds', () => {
  const tree = buildTree([sable, support, deploy, orbital, nightly, review])

  it('opens the selected path', () => {
    const forest = visibleIdentityForest(tree, 'all', '', 'newest')
    const ids = autoExpandedIdentityIds(tree, 'review', forest, false)
    expect([...ids]).toEqual(
      expect.arrayContaining(['sable', 'support', 'review']),
    )
  })

  it('opens every remaining branch while searching', () => {
    const forest = visibleIdentityForest(tree, 'all', 'review', 'newest')
    const ids = autoExpandedIdentityIds(tree, null, forest, true)
    expect(ids.has('sable')).toBe(true)
    expect(ids.has('support')).toBe(true)
    expect(ids.has('orbital')).toBe(false)
  })
})
