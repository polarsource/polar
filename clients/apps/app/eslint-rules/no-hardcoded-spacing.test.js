/**
 * Tests for no-hardcoded-spacing ESLint rule
 * Run with: node eslint-rules/no-hardcoded-spacing.test.js
 */

const { RuleTester } = require('eslint')
const rule = require('./no-hardcoded-spacing')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
})

ruleTester.run('no-hardcoded-spacing', rule, {
  valid: [
    {
      code: `<Box style={{ padding: theme.spacing['spacing-16'] }} />`,
    },
    {
      code: `<Box style={{ margin: theme.spacing['spacing-8'] }} />`,
    },
    {
      code: `<Box style={{ gap: theme.spacing['spacing-12'] }} />`,
    },
    {
      code: `<Box style={{ padding: '10%' }} />`,
    },
    {
      code: `<Box style={{ flex: 1, opacity: 0.5, zIndex: 10 }} />`,
    },
    {
      code: `<Box style={{ width: 100, height: 200 }} />`,
    },
    {
      code: `<Box style={{ borderRadius: 8, borderWidth: 1 }} />`,
    },
    {
      code: `<Box style={{ padding: 0, margin: 0 }} />`,
    },
  ],

  invalid: [
    {
      code: `<Box style={{ padding: 16 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'padding', value: 16 },
        },
      ],
    },
    {
      code: `<Box style={{ margin: 8 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'margin', value: 8 },
        },
      ],
    },
    {
      code: `<Box style={{ gap: 12 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'gap', value: 12 },
        },
      ],
    },
    {
      code: `<Box style={{ paddingTop: 10, paddingBottom: 20 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'paddingTop', value: 10 },
        },
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'paddingBottom', value: 20 },
        },
      ],
    },
    {
      code: `<Box style={{ paddingLeft: 5, paddingRight: 5 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'paddingLeft', value: 5 },
        },
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'paddingRight', value: 5 },
        },
      ],
    },
    {
      code: `<Box style={{ paddingHorizontal: 16, paddingVertical: 8 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'paddingHorizontal', value: 16 },
        },
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'paddingVertical', value: 8 },
        },
      ],
    },
    {
      code: `<Box style={{ marginTop: 10, marginBottom: 20 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'marginTop', value: 10 },
        },
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'marginBottom', value: 20 },
        },
      ],
    },
    {
      code: `<Box style={{ marginLeft: 5, marginRight: 5 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'marginLeft', value: 5 },
        },
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'marginRight', value: 5 },
        },
      ],
    },
    {
      code: `<Box style={{ marginHorizontal: 16, marginVertical: 8 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'marginHorizontal', value: 16 },
        },
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'marginVertical', value: 8 },
        },
      ],
    },
    {
      code: `<Box style={{ rowGap: 10, columnGap: 20 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'rowGap', value: 10 },
        },
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'columnGap', value: 20 },
        },
      ],
    },
    {
      code: `<ScrollView contentContainerStyle={{ padding: 16 }} />`,
      errors: [
        {
          messageId: 'noHardcodedSpacing',
          data: { property: 'padding', value: 16 },
        },
      ],
    },
  ],
})
