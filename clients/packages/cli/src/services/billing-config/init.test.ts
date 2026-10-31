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
import { init, type InitTarget } from '@/services/billing-config/init'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const productsUrl =
  'https://sandbox-api.polar.sh/v1/products/?limit=1&is_archived=false'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const products = (total_count: number) =>
  Response.json({ items: [], pagination: { total_count, max_page: 1 } })

let api: ReturnType<typeof fakeHttp>
let directory: string
let cwd: string

beforeEach(async () => {
  api = fakeHttp({ [`GET ${productsUrl}`]: products(0) })
  directory = await realpath(await mkdtemp(join(tmpdir(), 'polar-init-')))
  cwd = process.cwd()
  process.chdir(directory)
})

afterEach(async () => {
  process.chdir(cwd)
  await rm(directory, { recursive: true, force: true })
})

const run = (target: Partial<InitTarget> = {}) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
        local: yield* authenticatedClient('local'),
      }
      const fs = yield* FileSystem.FileSystem
      return yield* init(fs, clients)(acme, {
        directory,
        file: undefined,
        format: undefined,
        template: 'empty',
        ...target,
      })
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
      template: 'empty',
      install: ['npm', 'install', '@polar-sh/polar'],
    })
    expect(await read('polar.config.ts')).toContain(
      "import { defineConfig } from '@polar-sh/polar'",
    )
    expect(api.requests[0]!.headers.get('Polar-Organization')).toBe('org-1')
  })

  test('writes into the project directory and shows the path from the current one', async () => {
    await project()
    await mkdir(join(directory, 'src'))
    process.chdir(join(directory, 'src'))

    const result = await run()

    expect(result.file).toBe('../polar.config.ts')
    expect(await read('polar.config.ts')).toContain('defineConfig')
  })

  test('writes a JSON demo to the given path with nothing to install', async () => {
    const result = await run({
      file: 'billing/polar.config.json',
      template: 'demo',
    })

    expect(result).toEqual({
      file: 'billing/polar.config.json',
      format: 'json',
      template: 'demo',
      install: undefined,
    })
    const written = JSON.parse(await read('billing/polar.config.json'))
    expect(
      written.products.map(
        (product: { external_id: string }) => product.external_id,
      ),
    ).toEqual(['free', 'pro'])
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

  test('has nothing to install once the package is there, or without a package.json', async () => {
    expect((await run({ file: 'a.ts' })).install).toBeUndefined()

    await project()
    await mkdir(join(directory, 'node_modules/@polar-sh/polar'), {
      recursive: true,
    })
    await writeFile(
      join(directory, 'node_modules/@polar-sh/polar/package.json'),
      '{}',
    )
    expect((await run({ file: 'b.ts' })).install).toBeUndefined()
  })

  test('uses --format for the default file name', async () => {
    expect((await run({ format: 'json' })).file).toBe('polar.config.json')
  })

  test('refuses when the directory already has a config file', async () => {
    await writeFile(join(directory, 'polar.json'), '{}')

    const error = await failure(run())

    expect(error.message).toBe('. already has polar.json')
    expect(error.hint).toContain('polar config plan')
    expect(api.requests).toHaveLength(0)
  })

  test('refuses to overwrite the given file', async () => {
    await writeFile(join(directory, 'polar.config.ts'), 'keep')

    const error = await failure(run({ file: 'polar.config.ts' }))

    expect(error.message).toBe('polar.config.ts already exists')
    expect(await read('polar.config.ts')).toBe('keep')
  })

  test('refuses an organization that already has products and writes nothing', async () => {
    api.routes[`GET ${productsUrl}`] = products(3)

    const error = await failure(run())

    expect(error.message).toBe('Acme already has 3 products')
    expect(error.hint).toContain('without products')
    await expect(read('polar.config.ts')).rejects.toThrow()
  })

  test('refuses file types it cannot write and a mismatched --format', async () => {
    expect((await failure(run({ file: 'polar.config.mjs' }))).message).toBe(
      'polar.config.mjs is not a file init can write',
    )
    expect(
      (await failure(run({ file: 'polar.json', format: 'ts' }))).message,
    ).toBe('polar.json is a .json file, but --format is ts')
  })

  test('names the scope when the token cannot read products', async () => {
    api.routes[`GET ${productsUrl}`] = Response.json(
      { error: 'NotPermitted' },
      { status: 403 },
    )

    const error = await failure(run())

    expect(error.message).toBe('You do not have access to Acme')
    expect(error.hint).toBe('The token needs the products:read scope.')
  })
})
