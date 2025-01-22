import { defineConfig, Options } from 'tsup'
import pkg from './package.json'

const entry = Object.keys(pkg.exports).reduce((acc, key) => {
  const packageName = key.replace(/^\.\//, '')
  const sourceName = pkg.exports[key].source
  return {
    ...acc,
    [packageName]: sourceName,
  }
}, {})

export const options: Options = {
  entry,
  format: ['cjs', 'esm'],
  minify: true,
  dts: true,
  bundle: true,
}

export default defineConfig(options)
