import { dirname, join } from "path";
import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
    '../../../packages/polarkit/src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-essentials"),
    getAbsolutePath("@storybook/addon-interactions"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/nextjs"),
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  previewHead: (head) => `
  ${head}
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  `,
}
export default config

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}
