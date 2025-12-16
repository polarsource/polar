const { RuleTester } = require('eslint')
const rule = require('./no-touchable')

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

ruleTester.run('no-touchable', rule, {
  valid: [
    {
      code: `
        import { Touchable } from '@/components/Shared/Touchable';
        const Component = () => <Touchable onPress={() => {}}><Text>Press me</Text></Touchable>;
      `,
    },
    {
      code: `
        import { TouchableOpacity } from 'some-other-package';
        const Component = () => <TouchableOpacity />;
      `,
    },
    {
      code: `
        const TouchableOpacity = () => <div />;
        const Component = () => <TouchableOpacity />;
      `,
    },
    {
      code: `
        import { Text, View } from 'react-native';
        import { Touchable } from '@/components/Shared/Touchable';
        const Component = () => <Touchable><Text>Hello</Text></Touchable>;
      `,
    },
    {
      code: `
        import { Pressable } from 'react-native';
        const Component = () => <Pressable onPress={() => {}} />;
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { TouchableOpacity } from 'react-native';
        const Component = () => <TouchableOpacity onPress={() => {}} />;
      `,
      errors: [{ messageId: 'noTouchable' }],
    },
    {
      code: `
        import { TouchableHighlight } from 'react-native';
        const Component = () => <TouchableHighlight onPress={() => {}} />;
      `,
      errors: [{ messageId: 'noTouchable' }],
    },
    {
      code: `
        import { TouchableWithoutFeedback } from 'react-native';
        const Component = () => <TouchableWithoutFeedback onPress={() => {}} />;
      `,
      errors: [{ messageId: 'noTouchable' }],
    },
    {
      code: `
        import { TouchableNativeFeedback } from 'react-native';
        const Component = () => <TouchableNativeFeedback onPress={() => {}} />;
      `,
      errors: [{ messageId: 'noTouchable' }],
    },
    {
      code: `
        import { TouchableOpacity, Text } from 'react-native';
        const Component = () => <TouchableOpacity><Text>Hello</Text></TouchableOpacity>;
      `,
      errors: [{ messageId: 'noTouchable' }],
    },
    {
      code: `
        import { TouchableOpacity, TouchableHighlight } from 'react-native';
        const Component = () => (
          <TouchableOpacity>
            <TouchableHighlight />
          </TouchableOpacity>
        );
      `,
      errors: [{ messageId: 'noTouchable' }, { messageId: 'noTouchable' }],
    },
  ],
})
