import { dirname, join, resolve } from 'node:path'
import type { Import, Language } from '@/linters/language'

const EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']

const SCRIPT_FOR = { '.js': '.ts', '.mjs': '.mts', '.cjs': '.cts' } as const

const transpiler = new Bun.Transpiler({ loader: 'ts' })

const positionOf = (source: string, specifier: string) => {
  const quoted = [`'${specifier}'`, `"${specifier}"`, `\`${specifier}\``]
    .map((text) => source.indexOf(text))
    .filter((index) => index !== -1)
  const index = Math.min(...quoted) + 1
  const before = source.slice(0, index)
  return {
    line: before.split('\n').length,
    column: index - before.lastIndexOf('\n'),
  }
}

const scanned = (source: string) => {
  try {
    return transpiler.scanImports(source)
  } catch {
    return []
  }
}

const scanImports = (source: string): ReadonlyArray<Import> =>
  scanned(source).map(({ path }) => ({
    specifier: path,
    ...positionOf(source, path),
  }))

export const typescript: Language = {
  extensions: EXTENSIONS,
  lineComment: '//',
  blockComment: ['/*', '*/'],
  patterns: {
    clock: ['Date(', 'Date.now('],
    random: ['Math.random(', 'randomUUID('],
    environment: ['process.env', 'Bun.env', 'import.meta.env'],
    network: ['fetch('],
    filesystem: ['readFile(', 'readFileSync(', 'Bun.file('],
  },
  modules: {
    network: ['node:http', 'http', 'node:https', 'https'],
    filesystem: ['node:fs', 'fs', 'node:child_process', 'child_process'],
  },
  imports: (source) => scanImports(source),
  relative: (specifier) =>
    specifier.startsWith('./') || specifier.startsWith('../'),
  candidates: (from, specifier) => {
    const base = resolve(dirname(from), specifier)
    const extension = Object.keys(SCRIPT_FOR).find((key) => base.endsWith(key))
    return [
      base,
      ...EXTENSIONS.map((suffix) => `${base}${suffix}`),
      ...(extension === undefined
        ? []
        : [
            `${base.slice(0, -extension.length)}${SCRIPT_FOR[extension as keyof typeof SCRIPT_FOR]}`,
          ]),
      ...EXTENSIONS.map((suffix) => join(base, `index${suffix}`)),
    ]
  },
}
