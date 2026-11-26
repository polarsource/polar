import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import rule from './no-terminal-output.ts'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester().run('no-terminal-output', rule, {
  valid: [
    {
      name: 'returning data',
      filename: 'src/client/customer.ts',
      code: `const customer = (id: string) => ({ id })`,
    },
    {
      name: 'tests are exempt',
      filename: 'src/client/customer.test.ts',
      code: `console.log('debugging a test')`,
    },
    {
      name: 'a type-only import of a prompt module',
      filename: 'src/client/connect.ts',
      code: `import type { Interface } from 'node:readline'`,
    },
  ],
  invalid: [
    {
      name: 'console',
      filename: 'src/errors.ts',
      code: `console.error('failed')`,
      errors: [{ messageId: 'print' }],
    },
    {
      name: 'writing to stdout',
      filename: 'src/errors.ts',
      code: `process.stdout.write('failed')`,
      errors: [{ messageId: 'print' }],
    },
    {
      name: 'prompting',
      filename: 'src/client/connect.ts',
      code: `import { createInterface } from 'node:readline'`,
      errors: [{ messageId: 'prompt' }],
    },
    {
      name: 'loading a prompt module lazily',
      filename: 'src/client/connect.ts',
      code: `const readline = await import('node:readline')`,
      errors: [{ messageId: 'prompt' }],
    },
    {
      name: 'console through globalThis',
      filename: 'src/errors.ts',
      code: `globalThis.console.log('failed')`,
      errors: [{ messageId: 'print' }],
    },
    {
      name: 'stdout through globalThis',
      filename: 'src/errors.ts',
      code: `globalThis.process.stdout.write('failed')`,
      errors: [{ messageId: 'print' }],
    },
  ],
})
