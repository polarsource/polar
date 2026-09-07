import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// `h3` is a transitive dependency of the `nuxt` dev dependency and is not
// declared directly by this package, so it is not resolvable as a bare
// specifier from here. The `checkoutHandler` runtime imports `h3` (provided by
// the host Nuxt/Nitro app at runtime); to unit-test it directly we alias `h3`
// to the copy resolved through `nuxt`'s dependency graph. Resolving via
// `nuxt/package.json` keeps the alias version-agnostic across lockfile bumps.
const require = createRequire(import.meta.url)
const nuxtPkg = require.resolve('nuxt/package.json')
const h3Pkg = createRequire(nuxtPkg).resolve('h3/package.json')
const h3Entry = resolve(h3Pkg, '..', 'dist', 'index.mjs')

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { h3: h3Entry } },
})
