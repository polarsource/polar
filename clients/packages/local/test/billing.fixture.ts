// A valid billing module fixture (loaded by load-billing.test.ts), shaped like
// what an integrator would author — though using relative imports here.
import { perUnit, product } from '../src/dsl'
import { sumOf } from '../src/meter'
import { micros } from '../src/money'
import { rulesetHistory } from '../src/ruleset'

export const history = rulesetHistory([
  {
    version: 'fixture-1',
    effectiveFrom: Date.UTC(2026, 0, 1),
    plan: product('p')
      .meter('tokens', sumOf('amount'), perUnit(micros(1n)))
      .build(),
  },
])
