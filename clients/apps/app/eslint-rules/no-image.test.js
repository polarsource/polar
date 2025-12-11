const { RuleTester } = require('eslint')
const rule = require('./no-image')

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

ruleTester.run('no-image', rule, {
  valid: [
    {
      code: `
        import { Image } from '@/components/Shared/Image';
        const Component = () => <Image source={{ uri: 'test' }} />;
      `,
    },
    {
      code: `
        import { Image } from '@components/Shared/Image';
        const Component = () => <Image source={{ uri: 'test' }} />;
      `,
    },
    {
      code: `
        import { Image } from 'some-other-package';
        const Component = () => <Image />;
      `,
    },
    {
      code: `
        const Image = () => <div />;
        const Component = () => <Image />;
      `,
    },
    {
      code: `
        import { Text, View } from 'react-native';
        import { Image } from '@/components/Shared/Image';
        const Component = () => <Image source={{ uri: 'test' }} />;
      `,
    },
    {
      code: `
        import { ImageBackground } from 'react-native';
        const Component = () => <ImageBackground source={{ uri: 'test' }} />;
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { Image } from 'react-native';
        const Component = () => <Image source={{ uri: 'test' }} />;
      `,
      errors: [{ messageId: 'noImage' }],
    },
    {
      code: `
        import { Image } from 'expo-image';
        const Component = () => <Image source={{ uri: 'test' }} />;
      `,
      errors: [{ messageId: 'noImage' }],
    },
    {
      code: `
        import { Image, Text } from 'react-native';
        const Component = () => <Image source={{ uri: 'test' }} />;
      `,
      errors: [{ messageId: 'noImage' }],
    },
    {
      code: `
        import { Image } from 'expo-image';
        const Component = () => (
          <Image source={{ uri: 'test1' }}>
            <Image source={{ uri: 'test2' }} />
          </Image>
        );
      `,
      errors: [{ messageId: 'noImage' }, { messageId: 'noImage' }],
    },
  ],
})
