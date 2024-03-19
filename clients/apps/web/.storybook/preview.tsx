import type { Preview } from '@storybook/react'
import '../src/styles/globals.scss'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    // actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
}

const classNames = (...strs: string[]): string => {
  return strs.join(' ')
}

export const decorators = [
  (StoryFn, { globals, parameters }) => {
    type Layouts = 'stacked' | 'side-by-side' | 'none'

    const themeLayout = parameters?.layout || 'stacked'
    const themes = parameters?.themes || ['light-striped', 'dark-striped']
    const padding = parameters?.padding || 'p-4'

    const themeConfigs = {
      'light-striped': {
        outer: 'bg-gray-50',
        stripes: 'bg-stripes-sky-100',
        inner: 'light text-gray-900',
      },
      'dark-striped': {
        outer: 'bg-[#111217]',
        stripes: 'bg-stripes-gray-900',
        inner: 'dark text-gray-200',
      },
      light: {
        outer: 'bg-gray-50',
        stripes: '',
        inner: 'light text-gray-900',
      },
      dark: {
        outer: 'bg-[#111217]',
        stripes: '',
        inner: 'dark text-gray-200',
      },
    }

    const renderThemes = themes.map(
      (t) => themeConfigs[t] || themeConfigs['light-striped'],
    )

    return (
      <div
        style={{
          fontFamily: 'Inter var, sans-serif',
        }}
        className={classNames(
          'flex antialiased',
          themeLayout === 'side-by-side'
            ? 'flex-row space-x-8'
            : 'flex-col space-y-8',
        )}
      >
        {renderThemes.map((t) => (
          <div className={t.outer}>
            <div className={classNames('bg-stripes', padding, t.stripes)}>
              <div className={t.inner}>
                <StoryFn />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  },
]

export default preview
