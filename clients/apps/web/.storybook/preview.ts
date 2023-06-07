import type { Preview } from '@storybook/react'
import '../src/styles/globals.scss'

const preview: Preview = {
  parameters: {
    darkMode: {
      stylePreview: true,
      classTarget: 'html',
    },
    backgrounds: {
      default: 'gray-50',
      values: [
        {
          name: 'gray-50',
          value: '#FDFDFC',
        },
        {
          name: 'gray-950',
          value: '#111217',
        },
      ],
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
}

export default preview
