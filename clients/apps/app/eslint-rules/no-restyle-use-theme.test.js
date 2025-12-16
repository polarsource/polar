const { RuleTester } = require('eslint')
const rule = require('./no-restyle-use-theme')

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

ruleTester.run('no-restyle-use-theme', rule, {
  valid: [
    {
      code: `
        import { useTheme } from '@/design-system/useTheme';
        const Component = () => {
          const theme = useTheme();
          return null;
        };
      `,
    },
    {
      code: `
        import { ThemeProvider, createBox } from '@shopify/restyle';
        const Component = () => null;
      `,
    },
    {
      code: `
        import { useTheme } from 'some-other-package';
        const Component = () => {
          const theme = useTheme();
          return null;
        };
      `,
    },
    {
      code: `
        const useTheme = () => ({});
        const Component = () => {
          const theme = useTheme();
          return null;
        };
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { useTheme } from '@shopify/restyle';
        const Component = () => {
          const theme = useTheme();
          return null;
        };
      `,
      errors: [{ messageId: 'noRestyleUseTheme' }],
    },
    {
      code: `
        import { useTheme, ThemeProvider } from '@shopify/restyle';
        const Component = () => {
          const theme = useTheme();
          return null;
        };
      `,
      errors: [{ messageId: 'noRestyleUseTheme' }],
    },
    {
      code: `
        import { createBox, useTheme, createText } from '@shopify/restyle';
        const Component = () => {
          const theme = useTheme();
          return null;
        };
      `,
      errors: [{ messageId: 'noRestyleUseTheme' }],
    },
  ],
})
