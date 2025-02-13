import type { StorybookConfig } from '@storybook/nextjs'
import { dirname, join, resolve } from 'path'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/nextjs'),
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  previewHead: (head) => `
  ${head}
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  `,
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'geist/font/mono': resolve(__dirname, './geist-mono.mock.ts'),
        'geist/font/sans': resolve(__dirname, './geist-sans.mock.ts'),
      }
    }
    return config
  },
}
export default config

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')))
}
