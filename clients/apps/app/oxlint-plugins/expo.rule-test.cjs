const { RuleTester } = require('oxlint/plugins-dev')
const expo = require('./expo')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

ruleTester.run('no-dynamic-env-var', expo.rules['no-dynamic-env-var'], {
  valid: [{ code: 'const value = process.env.EXPO_PUBLIC_URL' }],
  invalid: [
    {
      code: 'const value = process.env[name]',
      errors: [{ messageId: 'unexpectedDynamicAccess' }],
    },
  ],
})

ruleTester.run(
  'no-env-var-destructuring',
  expo.rules['no-env-var-destructuring'],
  {
    valid: [{ code: 'const value = process.env.EXPO_PUBLIC_URL' }],
    invalid: [
      {
        code: 'const { EXPO_PUBLIC_URL } = process.env',
        errors: [{ messageId: 'unexpectedDestructuring' }],
      },
    ],
  },
)

ruleTester.run('use-dom-exports', expo.rules['use-dom-exports'], {
  valid: [
    {
      code: `'use dom'; export default function Component() {}`,
    },
  ],
  invalid: [
    {
      code: `'use dom'; export const value = 1`,
      errors: [
        { messageId: 'missingDefaultExport' },
        { messageId: 'noOtherExports' },
      ],
    },
  ],
})
