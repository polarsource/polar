import type { Preview } from '@storybook/react'
import '../src/styles/globals.scss'

const preview: Preview = {
  parameters: {
    darkMode: {
      // stylePreview: true,
      // classTarget: 'html',
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

export const decorators = [
  (StoryFn, { globals, parameters }) => {
    //const theme =
    // globals.theme || parameters.theme || (isChromatic() ? 'stacked' : 'light')

    return (
      <div className="flex flex-col space-y-8 antialiased">
        <div className="light bg-gray-50 p-4 text-gray-900">
          <StoryFn />
        </div>
        <div className="h-4 bg-red-200"></div>
        <div className="bg-gray-950 dark p-4 text-gray-200">
          <StoryFn />
        </div>
      </div>
    )
  },
]

export default preview
