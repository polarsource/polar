import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError, type PruneEntry } from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { loader } from '@/services/billing-config/load'
import { prune } from '@/services/billing-config/prune'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const pruneUrl = 'https://sandbox-api.polar.sh/v1/config/prune'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const source = `${JSON.stringify(
  {
    meters: [
      { external_id: 'apples', deprecated: true },
      { external_id: 'pears' },
    ],
    benefits: [{ external_id: 'beta', deprecated: true }],
  },
  null,
  2,
)}\n`

const apples: PruneEntry = {
  resource: 'meter',
  external_id: 'apples',
  customers: 0,
  referenced_by: [],
}
const beta: PruneEntry = {
  resource: 'benefit',
  external_id: 'beta',
  customers: 3,
  referenced_by: [],
}

let api: ReturnType<typeof fakeHttp>
let file: string

const run = (
  confirm: (
    entries: ReadonlyArray<PruneEntry>,
  ) => Effect.Effect<void, BillingConfigError>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
        local: yield* authenticatedClient('local'),
      }
      const load = loader(fs)
      return yield* prune(fs, load, clients)(yield* load(file), acme, confirm)
    }).pipe(
      Effect.provide(Layer.mergeAll(BunServices.layer, api.layer)),
      Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
    ),
  )

beforeEach(async () => {
  api = fakeHttp()
  const directory = await mkdtemp(join(tmpdir(), 'polar-prune-'))
  file = join(directory, 'polar.json')
  await writeFile(file, source)
})

afterEach(async () => {
  await rm(join(file, '..'), { recursive: true, force: true })
})

describe('prune', () => {
  test('removes the unused entries after confirming every deprecated one', async () => {
    api.routes[`POST ${pruneUrl}`] = Response.json({ entries: [apples, beta] })
    const seen: Array<ReadonlyArray<PruneEntry>> = []

    const result = await run((entries) =>
      Effect.sync(() => {
        seen.push(entries)
      }),
    )

    expect(seen).toEqual([[apples, beta]])
    expect(result).toEqual({ entries: [apples, beta], removed: true })
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      meters: [{ external_id: 'pears' }],
      benefits: [{ external_id: 'beta', deprecated: true }],
    })
  })

  test('leaves the file alone when confirmation fails', async () => {
    api.routes[`POST ${pruneUrl}`] = Response.json({ entries: [apples] })

    await expect(
      run(() => Effect.fail(new BillingConfigError({ message: 'cancelled' }))),
    ).rejects.toMatchObject({ message: 'cancelled' })
    expect(await readFile(file, 'utf8')).toBe(source)
  })

  test('leaves the file alone when it changed while confirming', async () => {
    api.routes[`POST ${pruneUrl}`] = Response.json({ entries: [apples] })
    const edited = source.replace('pears', 'plums')

    await expect(
      run(() => Effect.promise(() => writeFile(file, edited))),
    ).rejects.toMatchObject({
      message: expect.stringContaining('changed while pruning'),
    })
    expect(await readFile(file, 'utf8')).toBe(edited)
  })

  test('does not ask when nothing can be removed', async () => {
    api.routes[`POST ${pruneUrl}`] = Response.json({ entries: [beta] })

    const result = await run(() => Effect.die('should not confirm'))

    expect(result).toEqual({ entries: [beta], removed: false })
    expect(await readFile(file, 'utf8')).toBe(source)
  })
})

const script = (filter: string) =>
  [
    'const defineConfig = (config) =>',
    '  Object.fromEntries(',
    '    Object.entries(config).map(([section, entries]) => [',
    '      section,',
    '      Object.entries(entries()).map(([external_id, entry]) => ({ external_id, ...entry })),',
    '    ]),',
    '  )',
    '',
    'export default defineConfig({',
    '  meters: () => ({',
    `    apples: { deprecated: true, filter: ${filter} },`,
    "    pears: { filter: 'pears' },",
    '  }),',
    '})',
    '',
  ].join('\n')

describe('prune with a script config', () => {
  beforeEach(async () => {
    file = join(file, '..', 'polar.config.mjs')
  })

  test('removes the unused entries', async () => {
    await writeFile(file, script("'apples'"))
    api.routes[`POST ${pruneUrl}`] = Response.json({ entries: [apples] })

    const result = await run(() => Effect.void)

    expect(result).toEqual({ entries: [apples], removed: true })
    expect(await readFile(file, 'utf8')).toBe(
      script("'apples'").replace(/^ {4}apples:.*\n/m, ''),
    )
  })

  test('leaves the file alone when the edit does not load back the same', async () => {
    const source = script('/[{]/.source')
    await writeFile(file, source)
    api.routes[`POST ${pruneUrl}`] = Response.json({ entries: [apples] })

    await expect(run(() => Effect.void)).rejects.toMatchObject({
      message: expect.stringContaining('Could not remove apples'),
    })
    expect(await readFile(file, 'utf8')).toBe(source)
  })
})
