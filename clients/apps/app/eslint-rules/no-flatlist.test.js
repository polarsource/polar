const { RuleTester } = require('eslint')
const rule = require('./no-flatlist')

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

ruleTester.run('no-flatlist', rule, {
  valid: [
    {
      code: `
        import { FlashList } from '@shopify/flash-list';
        const Component = () => <FlashList data={[]} renderItem={() => null} />;
      `,
    },
    {
      code: `
        import { Text, View } from 'react-native';
        const Component = () => <View><Text>Hello</Text></View>;
      `,
    },
    {
      code: `
        import { FlatList } from 'some-other-package';
        const Component = () => <FlatList />;
      `,
    },
    {
      code: `
        const FlatList = () => <div />;
        const Component = () => <FlatList />;
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { FlatList } from 'react-native';
        const Component = () => <FlatList data={[]} renderItem={() => null} />;
      `,
      errors: [{ messageId: 'noFlatList' }],
    },
    {
      code: `
        import { FlatList, Text } from 'react-native';
        const Component = () => <FlatList data={[]} renderItem={() => null} />;
      `,
      errors: [{ messageId: 'noFlatList' }],
    },
  ],
})
