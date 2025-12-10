const { RuleTester } = require('eslint')
const rule = require('./no-view')

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

ruleTester.run('no-view', rule, {
  valid: [
    {
      code: `
        import { Box } from '@/components/Shared/Box';
        const Component = () => <Box />;
      `,
    },
    {
      code: `
        import { View } from 'some-other-package';
        const Component = () => <View />;
      `,
    },
    {
      code: `
        const View = () => <div />;
        const Component = () => <View />;
      `,
    },
    {
      code: `
        import { Text, TouchableOpacity } from 'react-native';
        import { Box } from '@/components/Shared/Box';
        const Component = () => <Box><Text>Hello</Text></Box>;
      `,
    },
    {
      code: `
        import { BottomSheetView } from '@gorhom/bottom-sheet';
        const Component = () => <BottomSheetView />;
      `,
    },
    {
      code: `
        import { Animated } from 'react-native';
        const Component = () => <Animated.View />;
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { View } from 'react-native';
        const Component = () => <View />;
      `,
      errors: [{ messageId: 'noView' }],
    },
    {
      code: `
        import { View, Text } from 'react-native';
        const Component = () => <View><Text>Hello</Text></View>;
      `,
      errors: [{ messageId: 'noView' }],
    },
    {
      code: `
        import { View } from 'react-native';
        const Component = () => <View style={{ flex: 1 }} />;
      `,
      errors: [{ messageId: 'noView' }],
    },
    {
      code: `
        import { View } from 'react-native';
        const Component = () => (
          <View>
            <View />
          </View>
        );
      `,
      errors: [{ messageId: 'noView' }, { messageId: 'noView' }],
    },
  ],
})
