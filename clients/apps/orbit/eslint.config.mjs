import { nextJsConfig } from '@polar-sh/eslint-config/next-js'

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    // Node-runtime config files use CommonJS globals (module, __dirname) and
    // are not part of the app source.
    ignores: ['.next/**', 'node_modules/**', 'babel.config.js', 'scripts/**'],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.mjs', '*.config.js'],
        },
      },
    },
  },
]
