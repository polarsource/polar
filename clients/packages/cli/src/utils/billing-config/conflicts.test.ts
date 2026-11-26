import { expect, test } from 'vitest'
import type { AppliedEntry } from '@/schemas/BillingConfig'
import {
  catalogNameConflict,
  draftConflicts,
} from '@/utils/billing-config/conflicts'

const entry = (
  section: string,
  id: string,
  action: AppliedEntry['action'],
): AppliedEntry => ({ section, id, action, diff: [] })

test('a drafted change the file leaves at its live value is a conflict', () => {
  expect(
    draftConflicts(
      [entry('products', 'pro', 'unchanged')],
      [
        {
          ...entry('products', 'pro', 'updated'),
          diff: [{ field: 'name', before: 'Pro+', after: 'Pro' }],
        },
      ],
    ),
  ).toEqual([
    {
      section: 'products',
      id: 'pro',
      action: 'updated',
      diff: [{ field: 'name', before: 'Pro', after: 'Pro+' }],
    },
  ])
})

test('a resource only the draft has is a conflict', () => {
  expect(draftConflicts([], [entry('benefits', 'vip', 'removed')])).toEqual([
    { section: 'benefits', id: 'vip', action: 'created', diff: [] },
  ])
})

test('a resource the draft removed and the file still has is a conflict', () => {
  expect(
    draftConflicts(
      [entry('products', 'legacy', 'unchanged')],
      [entry('products', 'legacy', 'created')],
    ),
  ).toEqual([
    { section: 'products', id: 'legacy', action: 'removed', diff: [] },
  ])
})

test('a change the file makes itself is not a conflict', () => {
  expect(
    draftConflicts(
      [
        entry('products', 'pro', 'updated'),
        entry('meters', 'calls', 'created'),
      ],
      [
        entry('products', 'pro', 'updated'),
        entry('meters', 'calls', 'created'),
      ],
    ),
  ).toEqual([])
})

test('a file that matches the draft has no conflicts', () => {
  expect(
    draftConflicts(
      [entry('products', 'pro', 'updated')],
      [entry('products', 'pro', 'unchanged')],
    ),
  ).toEqual([])
})

test('a draft renamed while the file keeps the live name is a conflict', () => {
  expect(
    catalogNameConflict(
      { before: { name: 'v1' }, name: 'v1' },
      { id: 'cat-draft', name: 'v2' },
    ),
  ).toEqual([
    {
      section: 'catalog',
      id: 'name',
      action: 'updated',
      diff: [{ field: 'name', before: 'v1', after: 'v2' }],
    },
  ])
})

test('a name the file changes itself, or an unnamed draft, is not a conflict', () => {
  const draft = { id: 'cat-draft', name: 'v2' }
  expect(
    catalogNameConflict({ before: { name: 'v1' }, name: 'v3' }, draft),
  ).toEqual([])
  expect(
    catalogNameConflict(
      { before: { name: 'v1' }, name: 'v1' },
      { ...draft, name: null },
    ),
  ).toEqual([])
  expect(catalogNameConflict(undefined, draft)).toEqual([])
})
