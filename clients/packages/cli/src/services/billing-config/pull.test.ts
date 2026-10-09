import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { loader } from '@/services/billing-config/load'
import { pull } from '@/services/billing-config/pull'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const exportUrl = 'https://sandbox-api.polar.sh/v1/config/'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const meter = {
  metadata: {},
  external_id: 'tool_calls',
  name: 'Tool Calls',
  unit: 'custom',
  custom_label: 'call',
  custom_multiplier: null,
  filter: {
    conjunction: 'and',
    clauses: [{ property: 'name', operator: 'eq', value: 'tool_call' }],
  },
  aggregation: { func: 'count' },
}

const exported = (config: unknown, skipped: unknown[] = []) =>
  Response.json({ config, skipped })

let api: ReturnType<typeof fakeHttp>
let directory: string

beforeEach(async () => {
  api = fakeHttp()
  directory = await mkdtemp(join(tmpdir(), 'polar-pull-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const run = (file: string | undefined, force = false) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
      }
      const fs = yield* FileSystem.FileSystem
      return yield* pull(fs, loader(fs), clients)(
        acme,
        file === undefined ? undefined : join(directory, file),
        force,
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

describe('pull', () => {
  test('exports the config for the organization and writes it as TypeScript', async () => {
    api.routes[`GET ${exportUrl}`] = exported({
      meters: [{ ...meter, metadata: { team: 'billing' } }],
    })

    const result = await run('polar.config.ts')

    expect(result).toEqual({
      status: 'written',
      file: join(directory, 'polar.config.ts'),
      entries: [{ section: 'meters', id: 'tool_calls' }],
      skipped: [],
    })
    expect(api.requests[0]!.headers.get('Polar-Organization')).toBe('org-1')
    const source = await readFile(join(directory, 'polar.config.ts'), 'utf8')
    expect(source).toContain("from '@polar-sh/polar'")
    expect(source).toContain('meter("Tool Calls")')
    expect(source).toContain('.unit("custom", "call")')
    expect(source).not.toContain('billing')
  })

  test('writes the document untouched as JSON and passes skipped resources through', async () => {
    const document = { meters: [meter], products: [{ external_id: 'pro' }] }
    const skipped = [
      { resource: 'meter', id: 'm-9', name: 'Old', reason: 'archived' },
    ]
    api.routes[`GET ${exportUrl}`] = exported(document, skipped)

    const result = await run('polar.json')

    expect(result.entries).toEqual([
      { section: 'meters', id: 'tool_calls' },
      { section: 'products', id: 'pro' },
    ])
    expect(result.status === 'written' && result.skipped).toEqual(skipped)
    expect(
      JSON.parse(await readFile(join(directory, 'polar.json'), 'utf8')),
    ).toEqual(document)
  })

  test('overwrites a file that matches the organization', async () => {
    const { custom_multiplier: _, metadata: __, unit, ...trimmed } = meter
    await writeFile(
      join(directory, 'polar.json'),
      JSON.stringify({ meters: [{ unit, ...trimmed }] }),
    )
    api.routes[`GET ${exportUrl}`] = exported({
      meters: [meter, { ...meter, external_id: 'fresh' }],
    })

    const result = await run('polar.json')

    expect(result.status).toBe('written')
    expect(
      JSON.parse(await readFile(join(directory, 'polar.json'), 'utf8')),
    ).toEqual({ meters: [meter, { ...meter, external_id: 'fresh' }] })
  })

  test('refuses to overwrite a file that differs from the organization', async () => {
    const before = JSON.stringify({
      meters: [
        { ...meter, name: 'Old name' },
        { ...meter, external_id: 'local' },
      ],
    })
    await writeFile(join(directory, 'polar.json'), before)
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const result = await run('polar.json')

    expect(result).toEqual({
      status: 'conflict',
      file: join(directory, 'polar.json'),
      entries: [
        { section: 'meters', id: 'tool_calls' },
        { section: 'meters', id: 'local' },
      ],
    })
    expect(await readFile(join(directory, 'polar.json'), 'utf8')).toBe(before)
  })

  test('writes the existing config file by default, else polar.config.ts', async () => {
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })
    const cwd = process.cwd()
    process.chdir(directory)
    try {
      const fresh = await run(undefined)
      expect(fresh.file).toBe('polar.config.ts')
      await rm('polar.config.ts')
      await writeFile('polar.json', JSON.stringify({ meters: [meter] }))
      const existing = await run(undefined)
      expect(existing.file).toBe('polar.json')
    } finally {
      process.chdir(cwd)
    }
  })

  test('overwrites a file it cannot read with --force', async () => {
    await writeFile(join(directory, 'polar.json'), '{not json')
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const result = await run('polar.json', true)

    expect(result.status).toBe('written')
    expect(
      JSON.parse(await readFile(join(directory, 'polar.json'), 'utf8')),
    ).toEqual({ meters: [meter] })
  })

  test('still compares a file that carries an organization_id', async () => {
    await writeFile(
      join(directory, 'polar.json'),
      JSON.stringify({
        organization_id: 'org-1',
        meters: [{ ...meter, name: 'Old name' }],
      }),
    )
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const result = await run('polar.json')

    expect(result.status).toBe('conflict')
  })

  test('refuses to overwrite a file with a field that is not a section', async () => {
    const before = JSON.stringify({ meter: [meter], $schema: 'x' })
    await writeFile(join(directory, 'polar.json'), before)
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const error = await failure(run('polar.json'))

    expect(error.message).toContain('not a config section: $schema')
    expect(await readFile(join(directory, 'polar.json'), 'utf8')).toBe(before)
  })

  test('refuses to overwrite a file that is not a config object', async () => {
    await writeFile(join(directory, 'polar.json'), '[1, 2]')
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const error = await failure(run('polar.json'))

    expect(error.message).toContain('does not contain a config object')
    expect(await readFile(join(directory, 'polar.json'), 'utf8')).toBe('[1, 2]')
  })

  test('refuses file types it cannot write', async () => {
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const error = await failure(run('polar.config.cjs'))

    expect(error.message).toContain('is not a file pull can write')
    expect(error.hint).toContain('.ts, .mts, .mjs or .json')
  })

  test('overwrites anyway with --force', async () => {
    await writeFile(
      join(directory, 'polar.json'),
      JSON.stringify({ meters: [{ ...meter, name: 'Old name' }] }),
    )
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const result = await run('polar.json', true)

    expect(result.status).toBe('written')
    expect(
      JSON.parse(await readFile(join(directory, 'polar.json'), 'utf8')),
    ).toEqual({ meters: [meter] })
  })

  test('creates the directory of the file', async () => {
    api.routes[`GET ${exportUrl}`] = exported({ meters: [meter] })

    const result = await run('billing/nested/polar.json')

    expect(result.status).toBe('written')
    expect(
      JSON.parse(
        await readFile(join(directory, 'billing/nested/polar.json'), 'utf8'),
      ),
    ).toEqual({ meters: [meter] })
  })

  test('points to JSON when a resource has no TypeScript syntax yet', async () => {
    api.routes[`GET ${exportUrl}`] = exported({
      meters: [{ ...meter, custom_multiplier: 1000 }],
    })

    const error = await failure(run('polar.config.ts'))

    expect(error.message).toContain('cannot be written as TypeScript yet')
    expect(error.hint).toContain('.json')
  })

  test('fails when the existing file cannot be loaded', async () => {
    await writeFile(join(directory, 'polar.json'), '{not json')

    const error = await failure(run('polar.json'))

    expect(error.message).toContain('is not valid JSON')
    expect(api.requests).toHaveLength(0)
  })

  test('explains when config is not enabled for the organization', async () => {
    api.routes[`GET ${exportUrl}`] = Response.json(
      { error: 'ConfigAsCodeNotEnabled' },
      { status: 403 },
    )

    const error = await failure(run('polar.json'))

    expect(error.message).toContain('not enabled for Acme')
  })

  test('names the scopes when the token cannot read the config', async () => {
    api.routes[`GET ${exportUrl}`] = Response.json(
      { error: 'NotPermitted' },
      { status: 403 },
    )

    const error = await failure(run('polar.json'))

    expect(error.message).toBe('You do not have access to Acme')
    expect(error.hint).toBe(
      'The token needs the meters:read, benefits:read, products:read scopes.',
    )
  })
})
