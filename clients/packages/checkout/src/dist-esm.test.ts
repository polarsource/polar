import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const distDir = join(import.meta.dirname, '../dist')

const entries = [
  'components/index.js',
  'hooks/index.js',
  'providers/index.js',
  'guards.js',
  'components/index.cjs',
  'hooks/index.cjs',
  'providers/index.cjs',
  'guards.cjs',
]

const collectBundles = (dir: string): string[] => {
  const files: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      files.push(...collectBundles(path))
    } else if (name.endsWith('.js') || name.endsWith('.cjs')) {
      files.push(path)
    }
  }
  return files
}

describe('checkout dist', () => {
  it('does not import node builtins', () => {
    for (const entry of entries) {
      expect(statSync(join(distDir, entry)).isFile()).toBe(true)
    }

    const offenders = collectBundles(distDir).filter((file) =>
      readFileSync(file, 'utf8').includes('node:'),
    )

    expect(offenders).toEqual([])
  })
})
