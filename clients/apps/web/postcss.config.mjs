import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const babelConfig = require('./babel.config.js')

export default {
  plugins: {
    '@stylexjs/postcss-plugin': {
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      babelConfig: {
        babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: babelConfig.plugins,
      },
    },
    '@tailwindcss/postcss': {},
  },
}
