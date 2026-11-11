import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import {
  init,
  type InitTarget,
  type NameResources,
} from '@/services/billing-config/init'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const exportUrl = 'https://sandbox-api.polar.sh/v1/config/'
const initUrl = 'https://sandbox-api.polar.sh/v1/config/init'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const EMPTY = { meters: [], benefits: [], products: [] }

const exported = (
  config: object = EMPTY,
  skipped: object[] = [],
  enabled = false,
) => Response.json({ enabled, config, skipped, catalog: null })

const acceptSuggestions: NameResources<never, never> = (resources) =>
  Effect.succeed(
    resources.map(({ resource, id, name, suggestion }) => ({
      resource,
      id,
      name,
      external_id: suggestion,
    })),
  )

let api: ReturnType<typeof fakeHttp>
let directory: string
let cwd: string

beforeEach(async () => {
  let enabled = false
  api = fakeHttp({
    [`GET ${exportUrl}`]: () => exported(EMPTY, [], enabled),
    [`POST ${initUrl}`]: () => {
      enabled = true
      return new Response(null, { status: 204 })
    },
  })
  directory = await realpath(await mkdtemp(join(tmpdir(), 'polar-init-')))
  cwd = process.cwd()
  process.chdir(directory)
})

afterEach(async () => {
  process.chdir(cwd)
  await rm(directory, { recursive: true, force: true })
})

const run = (
  target: Partial<InitTarget> = {},
  name: NameResources<never, never> = acceptSuggestions,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
        local: yield* authenticatedClient('local'),
      }
      const fs = yield* FileSystem.FileSystem
      return yield* init(fs, clients)(
        acme,
        {
          directory,
          file: undefined,
          format: undefined,
          ...target,
        },
        name,
      )
    }).pipe(
      Effect.provide(Layer.mergeAll(BunServices.layer, api.layer)),
      Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
    ),
  )

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure')
    },
    (error: unknown) => error as { message: string; hint?: string },
  )

const read = (file: string) => readFile(join(directory, file), 'utf8')

const project = (manifest = '{}') =>
  writeFile(join(directory, 'package.json'), manifest)

describe('init', () => {
  test('writes an empty TypeScript config and names the package to install', async () => {
    await project()

    const result = await run()

    expect(result).toEqual({
      file: 'polar.config.ts',
      format: 'ts',
      imported: { meters: 0, benefits: 0, products: 0 },
      keyed: [],
      skipped: [],
      install: ['npm', 'install', '@polar-sh/polar'],
      installDirectory: directory,
      already_enabled: false,
    })
    expect(await read('polar.config.ts')).toContain(
      "import { defineConfig } from '@polar-sh/polar'",
    )
    expect(api.requests[0]!.headers.get('Polar-Organization')).toBe('org-1')
  })

  test('enables config for the organization before writing the file', async () => {
    await run()

    const enable = api.requests.find((request) => request.url === initUrl)!
    expect(enable.method).toBe('POST')
    expect(enable.headers.get('Polar-Organization')).toBe('org-1')
  })

  test('does not enable an organization that already manages its catalog as code', async () => {
    api.routes[`GET ${exportUrl}`] = exported(EMPTY, [], true)

    const result = await run()

    expect(result.already_enabled).toBe(true)
    expect(api.urls()).not.toContain(initUrl)
    expect(await read('polar.config.json')).toBeDefined()
  })

  test('writes nothing when config cannot be enabled', async () => {
    api.routes[`POST ${initUrl}`] = Response.json(
      { error: 'NotPermitted' },
      { status: 403 },
    )

    const error = await failure(run())

    expect(error.message).toBe('You do not have access to Acme')
    expect(error.hint).toBe('The token needs the organizations:write scope.')
    await expect(read('polar.config.json')).rejects.toThrow()
  })

  test('writes nothing when the organization has benefits or products config cannot manage', async () => {
    const detail =
      'Config can only manage feature flag and meter credit benefits, and products with fixed, metered, seat-based or unit-based prices. Unsupported: benefit Priority support, product Tip jar.'
    api.routes[`GET ${exportUrl}`] = Response.json(
      { error: 'ConfigUnsupportedResources', detail },
      { status: 409 },
    )

    const error = await failure(run())

    expect(error.message).toBe('Config cannot manage everything in Acme yet')
    expect(error.hint).toBe(detail)
    expect(api.urls()).not.toContain(initUrl)
    await expect(read('polar.config.json')).rejects.toThrow()
  })

  test('writes into the project directory and shows the path from the current one', async () => {
    await project()
    await mkdir(join(directory, 'src'))
    process.chdir(join(directory, 'src'))

    const result = await run()

    expect(result.file).toBe('../polar.config.ts')
    expect(await read('polar.config.ts')).toContain('defineConfig')
  })

  test('writes an empty JSON config with nothing to install without a package.json', async () => {
    const result = await run()

    expect(result).toEqual({
      file: 'polar.config.json',
      format: 'json',
      imported: { meters: 0, benefits: 0, products: 0 },
      keyed: [],
      skipped: [],
      install: undefined,
      installDirectory: undefined,
      already_enabled: false,
    })
    expect(JSON.parse(await read('polar.config.json'))).toEqual({
      meters: [],
      benefits: [],
      products: [],
    })
  })

  test('picks the package manager from the lockfile, then from package.json', async () => {
    await project('{"packageManager":"yarn@4.0.0"}')
    expect((await run({ file: 'a.ts' })).install).toEqual([
      'yarn',
      'add',
      '@polar-sh/polar',
    ])

    await writeFile(join(directory, 'pnpm-lock.yaml'), '')
    expect((await run({ file: 'b.ts' })).install).toEqual([
      'pnpm',
      'add',
      '@polar-sh/polar',
    ])
  })

  test('has nothing to install once package.json declares the package, or without a package.json', async () => {
    expect((await run({ file: 'a.ts' })).install).toBeUndefined()

    await project('{"devDependencies":{"@polar-sh/polar":"^1.0.0"}}')
    expect((await run({ file: 'b.ts' })).install).toBeUndefined()
  })

  test('installs when the package is only left over in node_modules', async () => {
    await project()
    await mkdir(join(directory, 'node_modules/@polar-sh/polar'), {
      recursive: true,
    })
    await writeFile(
      join(directory, 'node_modules/@polar-sh/polar/package.json'),
      '{}',
    )

    expect((await run()).install).toEqual(['npm', 'install', '@polar-sh/polar'])
  })

  test('installs into the project root for a path given from a subdirectory', async () => {
    await project()
    await mkdir(join(directory, 'src'))
    process.chdir(join(directory, 'src'))

    const result = await run({ directory: process.cwd(), file: 'a.ts' })

    expect(result.install).toEqual(['npm', 'install', '@polar-sh/polar'])
    expect(result.installDirectory).toBe(directory)
  })

  test('reads the workspace package manager from a workspace package', async () => {
    await project('{"packageManager":"pnpm@10.0.0"}')
    const workspacePackage = join(directory, 'packages/app')
    await mkdir(workspacePackage, { recursive: true })
    await writeFile(join(workspacePackage, 'package.json'), '{}')

    const result = await run({ directory: workspacePackage })

    expect(result.install).toEqual(['pnpm', 'add', '@polar-sh/polar'])
    expect(result.installDirectory).toBe(workspacePackage)
  })

  test('uses --format for the default file name', async () => {
    expect((await run({ format: 'json' })).file).toBe('polar.config.json')
  })

  test('picks Python in a project with a pyproject.toml, TypeScript when it also has a package.json', async () => {
    await writeFile(join(directory, 'pyproject.toml'), '')
    const python = await run()
    await rm(join(directory, 'polar_config.py'))
    await project()
    const both = await run()

    expect(python.file).toBe('polar_config.py')
    expect(both.file).toBe('polar.config.ts')
  })

  test('writes a Python config with --format py', async () => {
    api.routes[`GET ${exportUrl}`] = exported(
      {
        ...EMPTY,
        meters: [
          {
            external_id: 'tool_call',
            name: 'Tool calls',
            filter: {
              conjunction: 'and',
              clauses: [
                { property: 'name', operator: 'eq', value: 'tool_call' },
              ],
            },
            aggregation: { func: 'count' },
          },
        ],
      },
      [],
      true,
    )

    const result = await run({ format: 'py' })

    expect(result.file).toBe('polar_config.py')
    expect(await read('polar_config.py')).toContain(
      'tool_call = Meter("Tool calls", on="tool_call")',
    )
  })

  test('refuses when the directory already has a config file', async () => {
    await writeFile(join(directory, 'polar.json'), '{}')

    const error = await failure(run())

    expect(error.message).toBe('polar.json already exists')
    expect(error.hint).toBe(
      "Move your config file aside and run polar config init to import Acme's catalog into a new file, then bring your changes over.",
    )
    expect(api.requests).toHaveLength(0)
  })

  test('refuses to overwrite the given file', async () => {
    await writeFile(join(directory, 'polar.config.ts'), 'keep')

    const error = await failure(run({ file: 'polar.config.ts' }))

    expect(error.message).toBe('polar.config.ts already exists')
    expect(await read('polar.config.ts')).toBe('keep')
    expect(api.requests).toHaveLength(0)
  })

  test('refuses file types it cannot write and a mismatched --format', async () => {
    expect((await failure(run({ file: 'polar.config.mjs' }))).message).toBe(
      'polar.config.mjs is not a file init can write',
    )
    expect(
      (await failure(run({ file: 'polar.json', format: 'ts' }))).message,
    ).toBe('polar.json is a .json file, but --format is ts')
  })

  test('names the scopes when the token cannot export the config', async () => {
    api.routes[`GET ${exportUrl}`] = Response.json(
      { error: 'NotPermitted' },
      { status: 403 },
    )

    const error = await failure(run())

    expect(error.message).toBe('You do not have access to Acme')
    expect(error.hint).toBe(
      'The token needs the organizations:read, meters:read, benefits:read, products:read scopes.',
    )
  })

  describe('an organization with a catalog', () => {
    const pro = {
      external_id: 'pro',
      name: 'Pro',
      description: null,
      recurring_interval: 'month',
      recurring_interval_count: 1,
      prices: [
        { amount_type: 'fixed', price_amount: 1000, price_currency: 'usd' },
      ],
      benefits: [],
      deprecated: null,
    }
    const unkeyed = [
      {
        resource: 'product',
        id: 'p-1',
        name: 'Pro',
        reason: 'missing_external_id',
      },
      {
        resource: 'product',
        id: 'p-2',
        name: 'Café Plan!',
        reason: 'missing_external_id',
      },
      { resource: 'meter', id: 'm-1', name: 'Old', reason: 'archived' },
      { resource: 'product', id: 'p-3', name: 'Tiers', reason: 'invalid' },
    ]

    beforeEach(() => {
      let exports = 0
      api.routes[`GET ${exportUrl}`] = () =>
        exports++ === 0
          ? exported({ ...EMPTY, products: [pro] }, unkeyed)
          : exported(
              {
                ...EMPTY,
                products: [
                  pro,
                  { ...pro, external_id: 'pro_2' },
                  { ...pro, external_id: 'cafe_plan' },
                ],
              },
              unkeyed.slice(2),
              true,
            )
    })

    test('names resources without an external ID, saves them and writes the full config', async () => {
      const offered: unknown[] = []

      const result = await run({ format: 'json' }, (resources, catalog) => {
        offered.push(...resources)
        return acceptSuggestions(resources, catalog)
      })

      expect(offered).toEqual([
        { resource: 'product', id: 'p-1', name: 'Pro', suggestion: 'pro_2' },
        {
          resource: 'product',
          id: 'p-2',
          name: 'Café Plan!',
          suggestion: 'cafe_plan',
        },
      ])
      const saves = api.requests.filter((request) => request.url === initUrl)
      expect(saves).toHaveLength(1)
      expect(await saves[0]!.json()).toEqual({
        external_ids: [
          { resource: 'product', id: 'p-1', external_id: 'pro_2' },
          { resource: 'product', id: 'p-2', external_id: 'cafe_plan' },
        ],
      })
      expect(result.imported).toEqual({ meters: 0, benefits: 0, products: 3 })
      expect(result.keyed.map(({ external_id }) => external_id)).toEqual([
        'pro_2',
        'cafe_plan',
      ])
      expect(result.skipped).toEqual([unkeyed[3]])
      const written = JSON.parse(await read('polar.config.json'))
      expect(
        written.products.map((p: { external_id: string }) => p.external_id),
      ).toEqual(['pro', 'pro_2', 'cafe_plan'])
      expect(written.products[0]).not.toHaveProperty('description')
      expect(written.products[0]).not.toHaveProperty('deprecated')
    })

    test('does not enable config when naming is cancelled', async () => {
      const error = await failure(
        run({ format: 'json' }, () => Effect.die(new Error('cancelled'))),
      )

      expect(error.message).toBe('cancelled')
      expect(api.urls()).not.toContain(initUrl)
      await expect(read('polar.config.json')).rejects.toThrow()
    })

    test('renders the imported products as TypeScript', async () => {
      await run({ format: 'ts' })

      expect(await read('polar.config.ts')).toContain('cafe_plan: product(')
    })

    test('reports why the external IDs were rejected and writes nothing', async () => {
      api.routes[`POST ${initUrl}`] = Response.json(
        {
          detail: [
            {
              type: 'value_error',
              loc: ['body', 'external_ids', 1, 'external_id'],
              msg: 'Another product already has this external ID.',
            },
          ],
        },
        { status: 422 },
      )

      const error = await failure(run({ format: 'json' }))

      expect(error.message).toBe('Could not save the external IDs')
      expect(error.hint).toBe(
        'cafe_plan (product Café Plan!): Another product already has this external ID.',
      )
      await expect(read('polar.config.json')).rejects.toThrow()
    })
  })
})
