import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import rule from './client-boundaries.ts'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester().run('client-boundaries', rule, {
  valid: [
    {
      name: 'calling internal',
      filename: 'src/client/customer.ts',
      code: `
        import { sendEvents } from '../internal/api/events'
        import { reconcile } from '@/internal/reconcile/run'
      `,
    },
    {
      name: 'using the schema',
      filename: 'src/client/connect.ts',
      code: `import type { Billing } from '../schema/billing'`,
    },
    {
      name: 'typing the Polar API',
      filename: 'src/client/actor.ts',
      code: `import type { Polar } from '../sdk'`,
    },
    {
      name: 'HTTP requests outside client',
      filename: 'src/internal/api/events.ts',
      code: `fetch('https://api.polar.sh/v1/events')`,
    },
    {
      name: 'tests are exempt',
      filename: 'src/client/connect.test.ts',
      code: `import { memory } from '../adapters/memory'`,
    },
  ],
  invalid: [
    {
      name: 'importing the Polar API',
      filename: 'src/client/customer.ts',
      code: `import { createPolar } from '../sdk'`,
      errors: [{ messageId: 'api' }],
    },
    {
      name: 'making an HTTP request',
      filename: 'src/client/customer.ts',
      code: `fetch('https://api.polar.sh/v1/events')`,
      errors: [{ messageId: 'fetch' }],
    },
    {
      name: 'importing an adapter',
      filename: 'src/client/connect.ts',
      code: `import { postgres } from '@/adapters/postgres'`,
      errors: [{ messageId: 'adapter' }],
    },
    {
      name: 'loading an adapter lazily',
      filename: 'src/client/connect.ts',
      code: `const load = () => import('../adapters/redis')`,
      errors: [{ messageId: 'adapter' }],
    },
  ],
})
