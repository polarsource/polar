const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

// This can be replaced with `find-yarn-workspace-root`
const monorepoRoot = path.resolve(__dirname, '../..')
const config = getSentryExpoConfig(__dirname)

const projectRoot = __dirname
// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot]
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

module.exports = config
