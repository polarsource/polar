/**
 * Tests for no-stylesheet-create ESLint rule
 * Run with: node eslint-rules/no-stylesheet-create.test.js
 */

const { RuleTester } = require('eslint')
const rule = require('./no-stylesheet-create')

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

ruleTester.run('no-stylesheet-create', rule, {
  valid: [
    {
      code: `
        const App = () => <View style={{ flex: 1, padding: 16 }} />;
      `,
    },
    {
      code: `
        import { StyleSheet } from 'react-native';
        const style = StyleSheet.absoluteFillObject;
      `,
    },
    {
      code: `
        import { StyleSheet } from 'react-native';
        const merged = StyleSheet.flatten([style1, style2]);
      `,
    },
    {
      code: `
        import { StyleSheet } from 'some-other-package';
        const styles = StyleSheet.create({ container: { flex: 1 } });
      `,
    },
    {
      code: `
        const StyleSheet = { create: (s) => s };
        const styles = StyleSheet.create({ container: { flex: 1 } });
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { StyleSheet } from 'react-native';
        const styles = StyleSheet.create({
          container: { flex: 1 }
        });
      `,
      errors: [{ messageId: 'noStyleSheetCreate' }],
    },
    {
      code: `
        import { View, StyleSheet, Text } from 'react-native';
        const styles = StyleSheet.create({
          container: { flex: 1 },
          text: { fontSize: 16 }
        });
      `,
      errors: [{ messageId: 'noStyleSheetCreate' }],
    },
    {
      code: `
        import { StyleSheet } from 'react-native';
        const styles1 = StyleSheet.create({ a: { flex: 1 } });
        const styles2 = StyleSheet.create({ b: { flex: 2 } });
      `,
      errors: [
        { messageId: 'noStyleSheetCreate' },
        { messageId: 'noStyleSheetCreate' },
      ],
    },
  ],
})
