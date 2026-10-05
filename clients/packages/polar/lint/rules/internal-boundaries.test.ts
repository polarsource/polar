import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import rule from './internal-boundaries.ts'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester().run('internal-boundaries', rule, {
  valid: [
    {
      name: 'using the schema and other internal code',
      filename: 'src/internal/reconcile/run.ts',
      code: `
        import type { Meter } from '../../schema/meter'
        import { sendEvents } from '../api/events'
      `,
    },
    {
      name: 'the public folders call internal',
      filename: 'src/client/customer.ts',
      code: `import { reconcile } from '../internal/reconcile/run'`,
    },
    {
      name: 'tests are exempt',
      filename: 'src/internal/reconcile/run.test.ts',
      code: `import { memory } from '../../adapters/memory'`,
    },
  ],
  invalid: [
    {
      name: 'depending on client',
      filename: 'src/internal/reconcile/run.ts',
      code: `import { connect } from '../../client/connect'`,
      errors: [{ messageId: 'public', data: { target: 'client' } }],
    },
    {
      name: 'depending on an adapter',
      filename: 'src/internal/reconcile/run.ts',
      code: `import { memory } from '@/adapters/memory'`,
      errors: [{ messageId: 'public', data: { target: 'adapters' } }],
    },
    {
      name: 'depending on a plugin',
      filename: 'src/internal/api/events.ts',
      code: `import { llm } from '../../plugins/llm'`,
      errors: [{ messageId: 'public', data: { target: 'plugins' } }],
    },
  ],
})
