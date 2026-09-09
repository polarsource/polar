import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { CLIConfig, layer } from '@/services/config'

let directory: string
let file: string
const configEffect = Effect.service(CLIConfig).pipe(
  Effect.provide(layer.pipe(Layer.provide(BunServices.layer))),
)

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'polar-cli-config-'))
  file = join(directory, 'polar-cli', 'config.json')
  vi.stubEnv('XDG_CONFIG_HOME', directory)
  vi.stubEnv('APPDATA', directory)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

test('missing config means no selection and clearing it creates no file', async () => {
  const config = await Effect.runPromise(configEffect)
  expect(
    await Effect.runPromise(config.getActiveOrganization('sandbox')),
  ).toBeUndefined()
  await Effect.runPromise(config.setActiveOrganization('sandbox', undefined))
  await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('persists only organization IDs and preserves the other environment when changing selection', async () => {
  const config = await Effect.runPromise(configEffect)
  await Effect.runPromise(
    config.setActiveOrganization('sandbox', 'org_sandbox'),
  )
  await Effect.runPromise(
    config.setActiveOrganization('production', 'org_production'),
  )
  const freshConfig = await Effect.runPromise(configEffect)
  expect(
    await Effect.runPromise(freshConfig.getActiveOrganization('sandbox')),
  ).toBe('org_sandbox')
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
    sandbox: { activeOrganizationId: 'org_sandbox' },
    production: { activeOrganizationId: 'org_production' },
  })
  await Effect.runPromise(
    freshConfig.setActiveOrganization('sandbox', undefined),
  )
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
    sandbox: {},
    production: { activeOrganizationId: 'org_production' },
  })
})

test.each(['{invalid', '{"sandbox":{"activeOrganizationId":123}}'])(
  'does not overwrite invalid config: %s',
  async (content) => {
    const config = await Effect.runPromise(configEffect)
    await Effect.runPromise(config.setActiveOrganization('sandbox', 'org'))
    await writeFile(file, content)
    await expect(
      Effect.runPromise(config.getActiveOrganization('sandbox')),
    ).rejects.toThrow('Invalid config')
    await expect(
      Effect.runPromise(config.setActiveOrganization('production', 'other')),
    ).rejects.toThrow('Invalid config')
    expect(await readFile(file, 'utf8')).toBe(content)
  },
)
