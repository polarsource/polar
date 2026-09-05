import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const clients = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(clients, 'adapters/nextjs/package.json'))
const { build, version } = createRequire(require.resolve('tsup'))('esbuild')
const [label, outputDirectory, clientFactory = 'createPolarCore'] =
  process.argv.slice(2)
if (!label || !outputDirectory) {
  throw new Error(
    'Usage: node scripts/measure-adapter-bundles.mjs <label> <output-directory> [createPolarCore|createPolar]',
  )
}
if (!['createPolarCore', 'createPolar'].includes(clientFactory)) {
  throw new Error('Client factory must be createPolarCore or createPolar')
}

const entries = {
  'adapter-utils': ['adapter-utils', 'src/index.ts'],
  'better-auth': ['better-auth', 'src/index.ts'],
  'better-auth/client': ['better-auth', 'src/client.ts'],
  nextjs: ['nextjs', 'src/index.ts'],
  'nuxt/module': ['nuxt', 'src/module.ts'],
  'nuxt/runtime': ['nuxt', 'src/runtime/server/index.ts'],
  'tanstack-start': ['tanstack-start', 'src/index.ts'],
}
const measurements = {}
await mkdir(outputDirectory, { recursive: true })
for (const [name, [adapter, entry]] of Object.entries(entries)) {
  const directory = resolve(clients, 'adapters', adapter)
  const variants = name === 'better-auth' ? [false, true] : [false]
  for (const configured of variants) {
    const key = configured ? `${name}/with-client` : name
    const result = await build({
      stdin: {
        contents: `export * from './${entry}';${name === 'nuxt/module' ? `export { default } from './${entry}';` : ''}${configured ? `import { ${clientFactory} } from '@polar-sh/sdk/2026-04'; export const client = ${clientFactory}({accessToken: process.env.POLAR_ACCESS_TOKEN});` : ''}`,
        resolveDir: directory,
        sourcefile: 'bundle-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      minify: true,
      treeShaking: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      write: false,
      metafile: true,
      alias: {
        '@polar-sh/adapter-utils': resolve(
          clients,
          'adapters/adapter-utils/src/index.ts',
        ),
      },
      external: [
        'next',
        'next/*',
        '@tanstack/*',
        '@nuxt/*',
        'nuxt',
        'nuxt/*',
        'h3',
        'better-auth',
        'better-auth/*',
        'zod',
        'zod/*',
      ],
    })
    const bytes = result.outputFiles[0].contents
    measurements[key] = {
      minifiedBytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 9 }).length,
    }
    const filename = key.replaceAll('/', '-')
    await writeFile(resolve(outputDirectory, `${label}-${filename}.mjs`), bytes)
    await writeFile(
      resolve(outputDirectory, `${label}-${filename}.meta.json`),
      JSON.stringify(result.metafile, null, 2),
    )
  }
}
const sdk = JSON.parse(
  await readFile(
    resolve(clients, 'adapters/nextjs/node_modules/@polar-sh/sdk/package.json'),
    'utf8',
  ),
)
const report = {
  label,
  node: process.version,
  esbuild: version,
  sdk: sdk.version,
  clientFactory,
  measurements,
}
await writeFile(
  resolve(outputDirectory, `${label}.json`),
  `${JSON.stringify(report, null, 2)}\n`,
)
console.log(JSON.stringify(report, null, 2))
