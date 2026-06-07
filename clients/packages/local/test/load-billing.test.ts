import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { loadBilling } from '../src/load-billing'

const here = import.meta.dirname

describe('loadBilling', () => {
  test('loads a module that exports a RulesetHistory as `history`', async () => {
    const history = await loadBilling(resolve(here, 'billing.fixture.ts'))
    expect(history.rulesets.map((r) => r.version)).toEqual(['fixture-1'])
  })

  test('rejects a module without a `history` export', async () => {
    await expect(
      loadBilling(resolve(here, 'not-billing.fixture.ts')),
    ).rejects.toThrow("must export 'history'")
  })

  test('rejects a missing file', async () => {
    await expect(
      loadBilling(resolve(here, 'does-not-exist.ts')),
    ).rejects.toThrow('could not load')
  })
})
