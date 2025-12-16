/**
 * Tests for no-text ESLint rule
 * Run with: node eslint-rules/no-text.test.js
 */

const { RuleTester } = require('eslint')
const rule = require('./no-text')

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

ruleTester.run('no-text', rule, {
  valid: [
    {
      code: `
        import { Text } from '@/components/Shared/Text';
        const App = () => <Text>Hello</Text>;
      `,
    },
    {
      code: `
        import { TextInput } from 'react-native';
        const App = () => <TextInput />;
      `,
    },
    {
      code: `
        import { TextStyle } from 'react-native';
        const style = { fontSize: 16 };
      `,
    },
    {
      code: `
        import { Animated } from 'react-native';
        const App = () => <Animated.Text>Hello</Animated.Text>;
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { Text } from 'react-native';
        const App = () => <Text>Hello</Text>;
      `,
      errors: [{ messageId: 'noText' }],
    },
    {
      code: `
        import { View, Text, TouchableOpacity } from 'react-native';
        const App = () => <Text>Hello</Text>;
      `,
      errors: [{ messageId: 'noText' }],
    },
    {
      code: `
        import { Text } from 'react-native';
        const App = () => <Text />;
      `,
      errors: [{ messageId: 'noText' }],
    },
  ],
})

console.log('All no-text tests passed!')
