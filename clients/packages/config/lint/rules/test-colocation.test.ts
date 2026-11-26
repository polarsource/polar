import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import rule from './test-colocation.ts'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester().run('test-colocation', rule, {
  valid: [
    {
      name: 'a test imports the module it is named after',
      filename: 'src/schema/money.test.ts',
      code: `import { usd } from './money'`,
    },
    {
      name: 'files that are not tests',
      filename: 'src/schema/money.ts',
      code: `import { field } from './field'`,
    },
    {
      name: 'a test loads its module lazily',
      filename: 'src/schema/money.test.ts',
      code: `const { usd } = await import('./money')`,
    },
  ],
  invalid: [
    {
      name: 'a test imports a different module',
      filename: 'src/schema/meter.test.ts',
      code: `import { usd } from './money'`,
      errors: [{ messageId: 'subject', data: { name: 'meter' } }],
    },
  ],
})
