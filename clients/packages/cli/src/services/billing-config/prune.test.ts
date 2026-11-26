import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization, AuthError } from '@/schemas/Auth'
import type {
  BillingConfigError,
  LoadedConfig,
  PruneEntry,
} from '@/schemas/BillingConfig'
import { Auth } from '@/services/auth'
import { loader } from '@/services/billing-config/load'
import { deprecations, prune } from '@/services/billing-config/prune'
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
  customers_count: 0,
  referenced_by: [],
}
const beta: PruneEntry = {
  resource: 'benefit',
  external_id: 'beta',
  customers_count: 3,
  referenced_by: [],
}

let api: ReturnType<typeof fakeHttp>
let file: string

const run = <A>(
  use: (
    service: {
      deprecations: ReturnType<typeof deprecations>
      prune: ReturnType<typeof prune>
    },
    config: LoadedConfig,
  ) => Effect.Effect<A, AuthError | BillingConfigError>,
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
      return yield* use(
        { deprecations: deprecations(clients), prune: prune(fs, load) },
        yield* load(file),
      )
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

describe('deprecations', () => {
  test('lists every deprecated entry from the API', async () => {
    api.routes[`POST ${pruneUrl}`] = Response.json({ entries: [apples, beta] })

    const entries = await run((service, config) =>
      service.deprecations(config, acme),
    )

    expect(entries).toEqual([apples, beta])
  })
})

describe('prune', () => {
  test('removes only the given entries', async () => {
    await run((service, config) => service.prune(config, [apples]))

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      meters: [{ external_id: 'pears' }],
      benefits: [{ external_id: 'beta', deprecated: true }],
    })
  })

  test('leaves the file alone when it changed after loading', async () => {
    const edited = source.replace('pears', 'plums')

    await expect(
      run((service, config) =>
        Effect.promise(() => writeFile(file, edited)).pipe(
          Effect.andThen(service.prune(config, [apples])),
        ),
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining('changed while pruning'),
    })
    expect(await readFile(file, 'utf8')).toBe(edited)
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

    await run((service, config) => service.prune(config, [apples]))

    expect(await readFile(file, 'utf8')).toBe(
      script("'apples'").replace(/^ {4}apples:.*\n/m, ''),
    )
  })

  test('leaves the file alone when the edit does not load back the same', async () => {
    const source = script('/[{]/.source')
    await writeFile(file, source)

    await expect(
      run((service, config) => service.prune(config, [apples])),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Could not remove apples'),
    })
    expect(await readFile(file, 'utf8')).toBe(source)
  })
})
