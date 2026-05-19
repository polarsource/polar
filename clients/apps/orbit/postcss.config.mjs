import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const babelConfig = require('./babel.config.js')

const config = {
  plugins: {
    '@stylexjs/postcss-plugin': {
      include: [
        'app/**/*.{js,jsx,ts,tsx}',
        'src/**/*.{js,jsx,ts,tsx}',
        '../../packages/orbit/src/**/*.{js,jsx,ts,tsx}',
      ],
      babelConfig: {
        babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: babelConfig.plugins,
      },
    },
    '@tailwindcss/postcss': {},
  },
}

export default config
