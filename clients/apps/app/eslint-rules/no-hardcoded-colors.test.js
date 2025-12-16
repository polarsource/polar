/**
 * Tests for no-hardcoded-colors ESLint rule
 * Run with: node eslint-rules/no-hardcoded-colors.test.js
 */

const { RuleTester } = require('eslint')
const rule = require('./no-hardcoded-colors')

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

ruleTester.run('no-hardcoded-colors', rule, {
  valid: [
    {
      code: `<View style={{ backgroundColor: theme.colors.background }} />`,
    },
    {
      code: `<View style={{ color: theme.colors.text }} />`,
    },
    {
      code: `<View style={{ borderColor: theme.colors.border }} />`,
    },
    {
      code: `<View style={{ fontFamily: 'Arial' }} />`,
    },
    {
      code: `<View style={{ backgroundColor: 'transparent' }} />`,
    },
    {
      code: `<View style={{ flex: 1, opacity: 0.5 }} />`,
    },
  ],

  invalid: [
    {
      code: `<View style={{ backgroundColor: '#ffffff' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: '#ffffff' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: '#FFFFFF' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: '#FFFFFF' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: '#fff' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: '#fff' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: '#ffffff80' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: '#ffffff80' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: '#fff8' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: '#fff8' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: 'rgb(255, 255, 255)' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: 'rgb(255, 255, 255)' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: {
            property: 'backgroundColor',
            value: 'rgba(255, 255, 255, 0.5)',
          },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: 'hsl(0, 0%, 100%)' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: 'hsl(0, 0%, 100%)' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: 'hsla(0, 0%, 100%, 0.5)' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: {
            property: 'backgroundColor',
            value: 'hsla(0, 0%, 100%, 0.5)',
          },
        },
      ],
    },
    {
      code: `<Text style={{ color: '#000000' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'color', value: '#000000' },
        },
      ],
    },
    {
      code: `<View style={{ borderColor: '#cccccc' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'borderColor', value: '#cccccc' },
        },
      ],
    },
    {
      code: `<View style={{ backgroundColor: '#fff', borderColor: '#000' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'backgroundColor', value: '#fff' },
        },
        {
          messageId: 'noHardcodedColor',
          data: { property: 'borderColor', value: '#000' },
        },
      ],
    },
    {
      code: `<View style={{ borderTopColor: '#fff', borderBottomColor: '#000' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'borderTopColor', value: '#fff' },
        },
        {
          messageId: 'noHardcodedColor',
          data: { property: 'borderBottomColor', value: '#000' },
        },
      ],
    },
    {
      code: `<View style={{ shadowColor: '#000000' }} />`,
      errors: [
        {
          messageId: 'noHardcodedColor',
          data: { property: 'shadowColor', value: '#000000' },
        },
      ],
    },
  ],
})
