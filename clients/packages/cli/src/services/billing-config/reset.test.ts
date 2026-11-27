import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { loader } from '@/services/billing-config/load'
import { type ResetPending, reset } from '@/services/billing-config/reset'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const catalogsUrl =
  'https://sandbox-api.polar.sh/v1/catalogs/?organization_id=org-1&status=draft&status=live'
const liveUrl = 'https://sandbox-api.polar.sh/v1/config/'
const draftUrl = 'https://sandbox-api.polar.sh/v1/config/?catalog_id=cat-draft'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const meter = (name: string) => ({
  external_id: 'calls',
  name,
  filter: { conjunction: 'and', clauses: [] },
  aggregation: { func: 'count' },
  unit: 'scalar',
})

const exported = (name: string) =>
  Response.json({
    enabled: true,
    config: { meters: [meter(name)], benefits: [], products: [] },
    skipped: [],
  })

const catalogs = (...statuses: ReadonlyArray<'draft' | 'live'>) =>
  Response.json({
    items: statuses.map((status) => ({
      id: `cat-${status}`,
      name: null,
      status,
    })),
  })

let directory: string
let cwd: string

beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'polar-reset-')))
  cwd = process.cwd()
  process.chdir(directory)
})

afterEach(async () => {
  process.chdir(cwd)
  await rm(directory, { recursive: true, force: true })
})

const run = (
  api: ReturnType<typeof fakeHttp>,
  approve: (pending: ResetPending) => Effect.Effect<void, BillingConfigError>,
  file?: string,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
        local: yield* authenticatedClient('local'),
      }
      const fs = yield* FileSystem.FileSystem
      return yield* reset(fs, clients)(acme, file, approve)
    }).pipe(
      Effect.provide(Layer.mergeAll(BunServices.layer, api.layer)),
      Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
    ),
  )

const read = (name = 'polar.config.json') =>
  readFile(join(directory, name), 'utf8')
const write = (content: string, name = 'polar.config.json') =>
  writeFile(join(directory, name), content)

const load = (name: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* loader(yield* FileSystem.FileSystem)(name)
    }).pipe(Effect.provide(BunServices.layer)),
  )

const installConfigPackage = async () => {
  const manifest = createRequire(import.meta.url).resolve(
    '@polar-sh/config/package.json',
  )
  await mkdir(join(directory, 'node_modules', '@polar-sh'), { recursive: true })
  await symlink(
    dirname(manifest),
    join(directory, 'node_modules', '@polar-sh', 'config'),
  )
}

describe('reset', () => {
  test('rewrites the file from the draft when there is one', async () => {
    await write('{ "meters": [] }\n')
    const approve = vi.fn(() => Effect.void)
    const api = fakeHttp({
      [catalogsUrl]: () => catalogs('draft', 'live'),
      [draftUrl]: () => exported('Drafted calls'),
    })

    const result = await run(api, approve)

    expect(result).toEqual({
      file: 'polar.config.json',
      source: 'draft',
      status: 'reset',
    })
    expect(approve).toHaveBeenCalledWith({
      file: 'polar.config.json',
      source: 'draft',
    })
    expect(await read()).toContain('"name": "Drafted calls"')
  })

  test('uses the live catalog when there is no draft', async () => {
    await write('{ "meters": [] }\n')
    const api = fakeHttp({
      [catalogsUrl]: () => catalogs('live'),
      [liveUrl]: () => exported('Live calls'),
    })

    const result = await run(api, () => Effect.void)

    expect(result.source).toBe('live')
    expect(await read()).toContain('"name": "Live calls"')
  })

  test('does not ask or write when the file already matches', async () => {
    await write('{ "meters": [] }\n')
    const api = fakeHttp({
      [catalogsUrl]: () => catalogs('draft', 'live'),
      [draftUrl]: () => exported('Drafted calls'),
    })
    await run(api, () => Effect.void)
    const approve = vi.fn(() => Effect.void)

    const result = await run(api, approve)

    expect(result.status).toBe('unchanged')
    expect(approve).not.toHaveBeenCalled()
  })

  test('leaves the file alone when the reset is not approved', async () => {
    await write('{ "meters": [] }\n')
    const api = fakeHttp({
      [catalogsUrl]: () => catalogs('draft', 'live'),
      [draftUrl]: () => exported('Drafted calls'),
    })

    await expect(
      run(api, () =>
        Effect.fail(new BillingConfigError({ message: 'Reset cancelled' })),
      ),
    ).rejects.toThrow('Reset cancelled')
    expect(await read()).toBe('{ "meters": [] }\n')
  })

  test('rewrites a TypeScript config as TypeScript that loads back as the draft', async () => {
    await installConfigPackage()
    await write(
      [
        '// Our pricing',
        "const name = 'Calls'",
        'export default { meters: [{ external_id: "calls", name }] }',
      ].join('\n'),
      'polar.config.ts',
    )
    const api = fakeHttp({
      [catalogsUrl]: () => catalogs('draft', 'live'),
      [draftUrl]: () => exported('Drafted calls'),
    })

    const result = await run(api, () => Effect.void)

    expect(result).toEqual({
      file: 'polar.config.ts',
      source: 'draft',
      status: 'reset',
    })
    const source = await read('polar.config.ts')
    expect(source).toContain("import { defineConfig } from '@polar-sh/config'")
    expect(source).not.toContain('// Our pricing')
    expect((await load('polar.config.ts')).input).toMatchObject({
      meters: [{ external_id: 'calls', name: 'Drafted calls' }],
    })
  })

  test('does not ask or write when a TypeScript config already matches', async () => {
    await write('export default {}', 'polar.config.ts')
    const api = fakeHttp({
      [catalogsUrl]: () => catalogs('draft', 'live'),
      [draftUrl]: () => exported('Drafted calls'),
    })
    await run(api, () => Effect.void)
    const approve = vi.fn(() => Effect.void)

    const result = await run(api, approve)

    expect(result.status).toBe('unchanged')
    expect(approve).not.toHaveBeenCalled()
  })

  test('refuses a file type it cannot write', async () => {
    await write('export default {}', 'polar.config.mjs')
    const api = fakeHttp({})

    await expect(
      run(api, () => Effect.void, 'polar.config.mjs'),
    ).rejects.toThrow('polar.config.mjs is not a file reset can write')
    expect(api.requests).toEqual([])
  })

  test('fails when there is no config file to reset', async () => {
    const api = fakeHttp({})

    await expect(run(api, () => Effect.void)).rejects.toThrow(
      'No billing config file found',
    )
    expect(api.requests).toEqual([])
  })
})
