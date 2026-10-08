import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import type { PulledConfig } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { pull, saver } from '@/services/billing-config/pull'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const pullUrl = 'https://sandbox-api.polar.sh/v1/config/'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const config: PulledConfig = {
  meters: [{ external_id: 'tool-calls', name: 'Tool calls' }],
}
const json = `${JSON.stringify(config, null, 2)}\n`

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure')
    },
    (error: unknown) => error as { message: string; hint?: string },
  )

describe('pull', () => {
  let api: ReturnType<typeof fakeHttp>

  beforeEach(() => {
    api = fakeHttp()
  })

  const run = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const clients = {
          sandbox: yield* authenticatedClient('sandbox'),
          production: yield* authenticatedClient('production'),
        }
        return yield* pull(clients)(acme)
      }).pipe(
        Effect.provide(api.layer),
        Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
      ),
    )

  test('fetches the config of the selected organization', async () => {
    const body = {
      config,
      skipped: [{ id: 'meter-1', name: 'Legacy', reason: 'archived' }],
    }
    api.routes[`GET ${pullUrl}`] = Response.json(body)

    expect(await run()).toEqual(body)
    expect(api.requests[0]?.headers.get('Polar-Organization')).toBe('org-1')
  })

  test('explains when config is not enabled', async () => {
    api.routes[`GET ${pullUrl}`] = Response.json(
      { error: 'ConfigAsCodeNotEnabled', detail: 'Not enabled' },
      { status: 403 },
    )

    const error = await failure(run())
    expect(error.message).toBe('Config is not enabled for Acme')
  })
})

describe('save', () => {
  let directory: string
  const cwd = process.cwd()

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'polar-pull-'))
    process.chdir(directory)
  })

  afterEach(async () => {
    process.chdir(cwd)
    await rm(directory, { recursive: true, force: true })
  })

  const save = (file: string | undefined, force = false) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* saver(yield* FileSystem.FileSystem)(file, config, force)
      }).pipe(Effect.provide(BunServices.layer)),
    )

  test('writes polar.config.json when there is no config file', async () => {
    expect(await save(undefined)).toEqual({
      file: 'polar.config.json',
      status: 'written',
    })
    expect(await readFile('polar.config.json', 'utf8')).toBe(json)
  })

  test('writes to the existing default config file', async () => {
    await writeFile('polar.config.ts', `export default ${json}`)

    expect(await save(undefined)).toEqual({
      file: 'polar.config.ts',
      status: 'unchanged',
    })
  })

  test('writes a default export to script files', async () => {
    await save('billing.ts')

    expect(await readFile('billing.ts', 'utf8')).toBe(`export default ${json}`)
  })

  test('refuses to overwrite a different file without force', async () => {
    await writeFile('polar.config.json', '{ "meters": [] }\n')

    const error = await failure(save(undefined))
    expect(error.message).toBe('polar.config.json already exists')
    expect(error.hint).toContain('--force')
    expect(await readFile('polar.config.json', 'utf8')).toBe(
      '{ "meters": [] }\n',
    )

    expect((await save(undefined, true)).status).toBe('written')
    expect(await readFile('polar.config.json', 'utf8')).toBe(json)
  })

  test('rejects file types it cannot write', async () => {
    const error = await failure(save('billing.yaml'))
    expect(error.message).toBe('Cannot write a config to billing.yaml')
  })
})
