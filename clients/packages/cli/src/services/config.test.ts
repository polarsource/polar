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
const sandboxOrg = { id: 'org_sandbox', environment: 'sandbox' as const }
const productionOrg = {
  id: 'org_production',
  environment: 'production' as const,
}

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
  expect(await Effect.runPromise(config.getActiveOrganization)).toBeUndefined()
  await Effect.runPromise(config.setActiveOrganization(undefined))
  await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('persists the selected organization with its environment', async () => {
  const config = await Effect.runPromise(configEffect)
  await Effect.runPromise(config.setActiveOrganization(sandboxOrg))
  await Effect.runPromise(config.setActiveOrganization(productionOrg))
  const freshConfig = await Effect.runPromise(configEffect)
  expect(await Effect.runPromise(freshConfig.getActiveOrganization)).toEqual(
    productionOrg,
  )
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
    activeOrganization: productionOrg,
  })
  await Effect.runPromise(freshConfig.setActiveOrganization(undefined))
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({})
})

test.each(['{invalid', '{"activeOrganization":{"id":123}}'])(
  'does not overwrite invalid config: %s',
  async (content) => {
    const config = await Effect.runPromise(configEffect)
    await Effect.runPromise(config.setActiveOrganization(sandboxOrg))
    await writeFile(file, content)
    await expect(
      Effect.runPromise(config.getActiveOrganization),
    ).rejects.toThrow('Invalid config')
    await expect(
      Effect.runPromise(config.setActiveOrganization(productionOrg)),
    ).rejects.toThrow('Invalid config')
    expect(await readFile(file, 'utf8')).toBe(content)
  },
)
