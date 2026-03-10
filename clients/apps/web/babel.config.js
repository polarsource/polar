const path = require('path')
const dev = process.env.NODE_ENV !== 'production'

module.exports = {
  presets: ['next/babel'],
  plugins: [
    [
      '@stylexjs/babel-plugin',
      {
        dev,
        runtimeInjection: false,
        treeshakeCompensation: true,
        unstable_moduleResolution: {
          type: 'commonJS',
          rootDir: __dirname,
        },
      },
    ],
  ],
}
