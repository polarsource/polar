import { assert, it } from '@effect/vitest'
import {
  describePlan,
  describeSummary,
  describeTarget,
} from '../src/cli/format'
import type { DeployEntry } from '../src/api/generated'

const entries: DeployEntry[] = [
  {
    reason: null,
    id: null,
    price_preview: null,
    kind: 'reducer',
    key: 'calls',
    action: 'create',
  },
  {
    reason: null,
    price_preview: null,
    kind: 'reducer',
    key: 'tokens',
    action: 'unchanged',
    id: 'r1',
  },
  {
    price_preview: null,
    kind: 'meter',
    key: 'tokens',
    action: 'update',
    reason: 'price changed',
    id: 'm1',
  },
  {
    reason: null,
    price_preview: null,
    kind: 'meter',
    key: 'legacy',
    action: 'orphan',
    id: 'm9',
  },
]

it('aligns visible entries and drops ids and unchanged rows', () => {
  assert.equal(
    describePlan(entries),
    [
      '+  reducer  calls   create',
      '~  meter    tokens  update  price changed',
      '?  meter    legacy  orphan',
    ].join('\n'),
  )
  assert.equal(describeSummary(entries), '2 to apply, 1 unchanged, 1 orphaned')
  assert.equal(
    describeTarget('New Fragment', 'new-fragment', 'http://localhost:8001'),
    'New Fragment (new-fragment)  http://localhost:8001',
  )
})

it('uses weight and italic, not hues', () => {
  const text = describePlan(entries, true)
  assert.include(text, '\x1b[1m+')
  assert.include(text, '\x1b[1m~')
  assert.include(text, '\x1b[2m\x1b[3m?')
  assert.include(text, '\x1b[2m\x1b[3mprice changed')
  assert.notInclude(text, '\x1b[32m')
  assert.notInclude(text, '\x1b[33m')
  assert.notInclude(text, '\x1b[35m')
  assert.include(describeSummary(entries, undefined, true), '\x1b[1m')
})
