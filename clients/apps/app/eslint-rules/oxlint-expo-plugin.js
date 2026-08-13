const expoConfig = require('eslint-config-expo/flat')

module.exports = expoConfig.find((config) => config.plugins?.expo).plugins.expo
