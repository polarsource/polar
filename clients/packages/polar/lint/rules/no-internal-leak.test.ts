import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import rule from './no-internal-leak.ts'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester().run('no-internal-leak', rule, {
  valid: [
    {
      name: 'importing internal is fine',
      filename: 'src/client/connect.ts',
      code: `import { run } from '../internal/reconcile/run'`,
    },
    {
      name: 're-exporting inside internal',
      filename: 'src/internal/api/index.ts',
      code: `export { client } from './client'`,
    },
    {
      name: 'exporting a binding that is not from internal',
      filename: 'src/client/index.ts',
      code: `
        import { run } from '../internal/reconcile/run'
        import { connect } from './connect'
        export { connect }
      `,
    },
  ],
  invalid: [
    {
      name: 'the package entry re-exports internal',
      filename: 'src/index.ts',
      code: `export * from './internal/api/client'`,
      errors: [{ messageId: 'leak' }],
    },
    {
      name: 'a public folder re-exports internal',
      filename: 'src/client/index.ts',
      code: `export { run } from '../internal/reconcile/run'`,
      errors: [{ messageId: 'leak' }],
    },
    {
      name: 'importing then exporting an internal binding',
      filename: 'src/client/index.ts',
      code: `
        import { run } from '../internal/reconcile/run'
        export { run }
      `,
      errors: [{ messageId: 'leak' }],
    },
    {
      name: 'exporting an internal binding under another name',
      filename: 'src/client/index.ts',
      code: `
        import { run } from '../internal/reconcile/run'
        export { run as reconcile }
      `,
      errors: [{ messageId: 'leak' }],
    },
    {
      name: 'exporting an internal binding as the default',
      filename: 'src/client/index.ts',
      code: `
        import { run } from '../internal/reconcile/run'
        export default run
      `,
      errors: [{ messageId: 'leak' }],
    },
  ],
})
