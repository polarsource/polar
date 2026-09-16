import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { assert } from '@effect/vitest'
import { run } from '../src/cli/index'
import { voidTs } from '../src/cli/init-source'
import { isConfig } from '../src/cli/config'

let directory: string
const load = async () => ({})

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'void-init-'))
  vi.spyOn(process, 'cwd').mockReturnValue(directory)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

const written = () => readFile(join(directory, 'void.ts'), 'utf8')

it('asks in a terminal; without one it needs --template and --storage', async () => {
  await expect(run(['init'], load)).rejects.toThrow(
    'Init needs a terminal to choose a template, or pass --template.',
  )
  await expect(run(['init', '--template', 'blank'], load)).rejects.toThrow(
    'Init needs a terminal to choose event storage, or pass --storage.',
  )
})

it('refuses to overwrite an existing void.ts', async () => {
  const out = join(directory, 'void.ts')
  await writeFile(out, 'existing\n')
  await expect(
    run(['init', '--template', 'blank', '--storage', 'none'], load),
  ).rejects.toThrow('already exists; pass --force to overwrite it')
  assert.equal(await readFile(out, 'utf8'), 'existing\n')
})

it('overwrites void.ts with --force', async () => {
  const out = join(directory, 'void.ts')
  await writeFile(out, 'existing\n')
  await run(
    ['init', '--force', '--template', 'usage', '--storage', 'none'],
    load,
  )
  assert.equal(await written(), voidTs('usage', 'none'))
})

it.each([
  ['usage', 'none'],
  ['llm', 'none'],
  ['credits', 'none'],
  ['blank', 'sqlite'],
  ['usage', 'sqlite'],
] as const)('writes --template %s --storage %s', async (template, storage) => {
  await run(['init', '--template', template, '--storage', storage], load)
  assert.equal(await written(), voidTs(template, storage))
})

it('rejects an unknown template or storage', async () => {
  await expect(run(['init', '--template', 'demo'], load)).rejects.toThrow(
    '--template must be blank, usage, llm, credits',
  )
  await expect(
    run(['init', '--template', 'blank', '--storage', 'memory'], load),
  ).rejects.toThrow('--storage must be none, sqlite')
})

const loadGenerated = async (url: string) => {
  const file = fileURLToPath(url)
  const resolved = file.replace(/\.ts$/, '.resolved.ts')
  const sources = join(import.meta.dirname, '../src')
  await writeFile(
    resolved,
    (await readFile(file, 'utf8'))
      .replaceAll(
        "'@void/sdk/config'",
        JSON.stringify(`${sources}/config/index`),
      )
      .replaceAll(
        "'@void/sdk/plugins'",
        JSON.stringify(`${sources}/plugins/index`),
      )
      .replaceAll("'@void/sdk'", JSON.stringify(`${sources}/index`)),
  )
  return import(pathToFileURL(resolved).href) as Promise<
    Record<string, unknown>
  >
}

it.each(['blank', 'usage', 'llm', 'credits'] as const)(
  'loads the %s template as a config',
  async (template) => {
    await run(['init', '--template', template, '--storage', 'none'], load)
    const module = await loadGenerated(
      pathToFileURL(join(directory, 'void.ts')).href,
    )
    assert.ok(isConfig([module.config, module.default].find(isConfig)))
  },
)
