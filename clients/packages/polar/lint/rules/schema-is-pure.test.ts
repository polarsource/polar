import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import rule from './schema-is-pure.ts'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester().run('schema-is-pure', rule, {
  valid: [
    {
      name: 'building a plain object',
      filename: 'src/schema/money.ts',
      code: `const usd = (amount: number) => ({ currency: 'usd', amount })`,
    },
    {
      name: 'the clock outside schema',
      filename: 'src/client/connect.ts',
      code: `const startedAt = Date.now()`,
    },
    {
      name: 'a fixed date',
      filename: 'src/schema/plan.ts',
      code: `const launch = new Date('2026-10-01')`,
    },
  ],
  invalid: [
    {
      name: 'network',
      filename: 'src/schema/billing.ts',
      code: `fetch('https://example.com')`,
      errors: [{ messageId: 'io' }],
    },
    {
      name: 'environment',
      filename: 'src/schema/billing.ts',
      code: `const token = process.env.TOKEN`,
      errors: [{ messageId: 'io' }],
    },
    {
      name: 'clock',
      filename: 'src/schema/plan.ts',
      code: `const createdAt = Date.now()`,
      errors: [{ messageId: 'unstable' }],
    },
    {
      name: 'randomness',
      filename: 'src/schema/plan.ts',
      code: `const id = Math.random()`,
      errors: [{ messageId: 'unstable' }],
    },
    {
      name: 'the current date',
      filename: 'src/schema/plan.ts',
      code: `const createdAt = new Date()`,
      errors: [{ messageId: 'unstable' }],
    },
    {
      name: 'the current date as a string',
      filename: 'src/schema/plan.ts',
      code: `const createdAt = Date()`,
      errors: [{ messageId: 'unstable' }],
    },
    {
      name: 'a random identifier',
      filename: 'src/schema/plan.ts',
      code: `const id = crypto.randomUUID()`,
      errors: [{ messageId: 'unstable' }],
    },
    {
      name: 'the clock through globalThis',
      filename: 'src/schema/plan.ts',
      code: `const createdAt = globalThis.Date.now()`,
      errors: [{ messageId: 'unstable' }],
    },
  ],
})
