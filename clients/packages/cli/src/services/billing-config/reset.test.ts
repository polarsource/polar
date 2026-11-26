import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
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

const read = () => readFile(join(directory, 'polar.config.json'), 'utf8')
const write = (content: string) =>
  writeFile(join(directory, 'polar.config.json'), content)

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

  test('fails when there is no config file to reset', async () => {
    const api = fakeHttp({})

    await expect(run(api, () => Effect.void)).rejects.toThrow(
      'No billing config file found',
    )
    expect(api.requests).toEqual([])
  })
})
