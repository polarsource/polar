/**
 * Tests for no-hardcoded-dimensions ESLint rule
 * Run with: node eslint-rules/no-hardcoded-dimensions.test.js
 */

const { RuleTester } = require('eslint')
const rule = require('./no-hardcoded-dimensions')

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

ruleTester.run('no-hardcoded-dimensions', rule, {
  valid: [
    {
      code: `<Box style={{ width: theme.dimension['dimension-48'] }} />`,
    },
    {
      code: `<Box style={{ height: theme.dimension['dimension-24'] }} />`,
    },
    {
      code: `<Box style={{ width: '100%' }} />`,
    },
    {
      code: `<Box style={{ height: '50%' }} />`,
    },
    {
      code: `<Box style={{ minWidth: '100%', maxHeight: '80%' }} />`,
    },
    {
      code: `<Box style={{ width: 'auto' }} />`,
    },
    {
      code: `<Box style={{ width: 0, height: 0 }} />`,
    },
    {
      code: `<Box style={{ flex: 1, opacity: 0.5, borderRadius: 8 }} />`,
    },
    {
      code: `<Box style={{ padding: theme.spacing['spacing-16'], margin: theme.spacing['spacing-8'] }} />`,
    },
  ],

  invalid: [
    {
      code: `<Box style={{ width: 100 }} />`,
      errors: [
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'width', value: 100 },
        },
      ],
    },
    {
      code: `<Box style={{ height: 200 }} />`,
      errors: [
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'height', value: 200 },
        },
      ],
    },
    {
      code: `<Box style={{ minWidth: 50 }} />`,
      errors: [
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'minWidth', value: 50 },
        },
      ],
    },
    {
      code: `<Box style={{ minHeight: 100 }} />`,
      errors: [
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'minHeight', value: 100 },
        },
      ],
    },
    {
      code: `<Box style={{ maxWidth: 300 }} />`,
      errors: [
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'maxWidth', value: 300 },
        },
      ],
    },
    {
      code: `<Box style={{ maxHeight: 400 }} />`,
      errors: [
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'maxHeight', value: 400 },
        },
      ],
    },
    {
      code: `<Box style={{ width: 100, height: 200 }} />`,
      errors: [
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'width', value: 100 },
        },
        {
          messageId: 'noHardcodedDimension',
          data: { property: 'height', value: 200 },
        },
      ],
    },
    {
      code: `<Box style={{ height: theme.spacing['spacing-6'] }} />`,
      errors: [
        {
          messageId: 'noSpacingForDimension',
          data: { property: 'height' },
        },
      ],
    },
    {
      code: `<Box style={{ width: theme.spacing['spacing-16'] }} />`,
      errors: [
        {
          messageId: 'noSpacingForDimension',
          data: { property: 'width' },
        },
      ],
    },
    {
      code: `<Box style={{ minHeight: theme.spacing['spacing-24'], maxWidth: theme.spacing['spacing-32'] }} />`,
      errors: [
        {
          messageId: 'noSpacingForDimension',
          data: { property: 'minHeight' },
        },
        {
          messageId: 'noSpacingForDimension',
          data: { property: 'maxWidth' },
        },
      ],
    },
  ],
})
