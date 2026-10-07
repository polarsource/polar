import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { locate, make } from '@/services/billing-config'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const applyUrl = 'https://sandbox-api.polar.sh/v1/config/apply'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const source = [
  '{',
  '  "meters": [',
  '    {',
  '      "external_id": "tool-calls",',
  '      "filter": { "conjunction": "qwe", "clauses": [] }',
  '    }',
  '  ]',
  '}',
].join('\n')

let api: ReturnType<typeof fakeHttp>
let directory: string

const service = () =>
  make.pipe(
    Effect.provide(Layer.mergeAll(BunServices.layer, api.layer)),
    Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
  )

const load = (file?: string) =>
  Effect.runPromise(
    service().pipe(Effect.flatMap((config) => config.load(file))),
  )

const apply = (file: string) =>
  Effect.runPromise(
    service().pipe(
      Effect.flatMap((billing) =>
        Effect.flatMap(billing.load(file), (config) =>
          billing.apply(config, acme),
        ),
      ),
    ),
  )

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure')
    },
    (error: unknown) =>
      error as { _tag: string; message: string; hint?: string },
  )

beforeEach(async () => {
  api = fakeHttp()
  directory = await mkdtemp(join(tmpdir(), 'polar-config-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const write = async (content: string, name = 'polar.json') => {
  const file = join(directory, name)
  await writeFile(file, content)
  return file
}

describe('load', () => {
  test('keeps the source text next to the parsed JSON', async () => {
    const config = await load(await write(source))
    expect(config.source).toBe(source)
    expect(config.input).toEqual(JSON.parse(source))
    expect(config.generated).toBe(false)
  })

  test('generates JSON from the default export of a TypeScript file', async () => {
    const file = await write(
      [
        "const meter = { external_id: 'tool-calls' as const }",
        'export default { meters: [meter] }',
      ].join('\n'),
      'polar.config.ts',
    )
    const config = await load(file)
    expect(config.generated).toBe(true)
    expect(config.input).toEqual({ meters: [{ external_id: 'tool-calls' }] })
    expect(config.source).toBe(JSON.stringify(config.input, null, 2))
  })

  test('calls a default exported function, sync or async', async () => {
    const sync = await load(
      await write("export default () => ({ meters: ['sync'] })", 'sync.ts'),
    )
    const async = await load(
      await write(
        "export default async () => ({ meters: ['async'] })",
        'async.ts',
      ),
    )
    expect(sync.input).toEqual({ meters: ['sync'] })
    expect(async.input).toEqual({ meters: ['async'] })
  })

  test('reports a default exported function that throws', async () => {
    const error = await failure(
      load(
        await write(
          'export default () => { throw new Error("boom") }',
          'throws.ts',
        ),
      ),
    )
    expect(error.message).toContain('Could not load')
    expect(error.hint).toContain('boom')
  })

  test('requires a default exported object from a script', async () => {
    const error = await failure(
      load(await write('export const config = {}', 'polar.config.ts')),
    )
    expect(error.message).toContain('does not default export')
  })

  test('reports scripts that fail to load', async () => {
    const error = await failure(
      load(await write('throw new Error("boom")', 'polar.config.js')),
    )
    expect(error.message).toContain('Could not load')
    expect(error.hint).toContain('boom')
  })

  test('rejects unsupported file types', async () => {
    const error = await failure(load(await write('config = {}', 'polar.py')))
    expect(error.message).toContain('is not a supported config file')
    expect(error.hint).toContain('.json, .ts or .js')
  })

  test('reports invalid JSON', async () => {
    const error = await failure(load(await write('{ "meters": [')))
    expect(error._tag).toBe('BillingConfigError')
    expect(error.message).toContain('is not valid JSON')
  })

  test('fails when the file cannot be read', async () => {
    const error = await failure(load(join(directory, 'missing.json')))
    expect(error.message).toContain('Could not read')
  })
})

describe('load without a file', () => {
  const cwd = process.cwd()

  beforeEach(() => process.chdir(directory))
  afterEach(() => process.chdir(cwd))

  test('picks the first default file name that exists', async () => {
    await write(source)
    await write("export default { meters: ['ts'] }", 'polar.config.ts')
    const config = await load()
    expect(config.file).toBe('polar.config.ts')
    expect(config.input).toEqual({ meters: ['ts'] })
  })

  test('falls back to polar.json', async () => {
    await write(source)
    expect((await load()).file).toBe('polar.json')
  })

  test('fails when no default file exists', async () => {
    const error = await failure(load())
    expect(error.message).toContain('No billing config file found')
    expect(error.hint).toContain('polar.config.ts')
  })
})

describe('locate', () => {
  test('finds the line and column of a value', () => {
    expect(locate(source, ['meters', 0, 'filter', 'conjunction'])).toEqual({
      line: 5,
      column: 34,
      length: 5,
    })
  })

  test('falls back to the closest parent for a missing key, underlining only its first line', () => {
    expect(locate(source, ['meters', 0, 'name'])).toEqual({
      line: 3,
      column: 5,
      length: 1,
    })
  })

  test('can point at the key instead of the value', () => {
    expect(locate(source, ['meters', 0, 'external_id'], 'key')).toEqual({
      line: 4,
      column: 7,
      length: 13,
    })
  })

  test('skips union tags that are not keys in the file', () => {
    expect(
      locate(source, ['meters', 0, 'filter', 'and', 'conjunction']),
    ).toEqual({ line: 5, column: 34, length: 5 })
  })
})

describe('apply', () => {
  test('posts the config for the organization and reports what happened', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json({
      meters: [
        { external_id: 'tool-calls', action: 'created' },
        { external_id: 'tokens', action: 'updated' },
      ],
    })

    const result = await apply(await write(source))

    const [request] = api.requests
    expect(request?.headers.get('Polar-Organization')).toBe('org-1')
    expect(await request?.json()).toEqual(JSON.parse(source))
    expect(result).toEqual({
      status: 'applied',
      entries: [
        { section: 'meters', id: 'tool-calls', action: 'created' },
        { section: 'meters', id: 'tokens', action: 'updated' },
      ],
    })
  })

  test('names entries of singleton sections after the section', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json({
      meters: [],
      organization: { action: 'updated' },
    })

    const result = await apply(await write(source))

    expect(result).toEqual({
      status: 'applied',
      entries: [
        { section: 'organization', id: 'organization', action: 'updated' },
      ],
    })
  })

  test('maps 422 validation errors onto the file', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      {
        error: 'RequestValidationError',
        detail: [
          {
            type: 'enum',
            loc: ['body', 'meters', 0, 'filter', 'conjunction'],
            msg: "Input should be 'and' or 'or'",
            input: 'qwe',
          },
          {
            type: 'missing',
            loc: ['body', 'meters', 0, 'name'],
            msg: 'Field required',
          },
        ],
      },
      { status: 422 },
    )

    const result = await apply(await write(source))

    expect(result).toEqual({
      status: 'rejected',
      issues: [
        {
          severity: 'error',
          code: 'enum',
          path: 'meters.0.filter.conjunction',
          message: "Input should be 'and' or 'or'",
          got: '"qwe"',
          location: { line: 5, column: 34, length: 5 },
        },
        {
          severity: 'error',
          code: 'missing',
          path: 'meters.0.name',
          message: 'Field required',
          got: undefined,
          location: { line: 3, column: 5, length: 1 },
        },
      ],
    })
  })

  test('maps a ConfigInvalid rejection with mixed severities onto the file', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      {
        error: 'ConfigInvalid',
        detail: [
          {
            severity: 'error',
            type: 'duplicate_external_id',
            loc: ['body', 'meters', 0, 'external_id'],
            msg: 'Duplicate external_id.',
            input: 'tool-calls',
          },
          {
            severity: 'warning',
            type: 'unknown_event',
            loc: ['body', 'meters', 0, 'filter', 'clauses', 0, 'value'],
            msg: 'No events with this name have been received yet.',
            input: 'tool_call',
          },
        ],
      },
      { status: 409 },
    )

    const result = await apply(await write(source))

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(
      result.issues.map((issue) => [issue.severity, issue.code, issue.path]),
    ).toEqual([
      ['error', 'duplicate_external_id', 'meters.0.external_id'],
      ['warning', 'unknown_event', 'meters.0.filter.clauses.0.value'],
    ])
  })

  test('asks to retry on a concurrent change', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      { error: 'ConfigMeterConflict', detail: 'Retry.' },
      { status: 409 },
    )

    const error = await failure(apply(await write(source)))

    expect(error.message).toContain('at the same time')
    expect(error.hint).toContain('again')
  })

  test('explains when config is not enabled for the organization', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      { error: 'ConfigAsCodeNotEnabled', detail: 'Config is not enabled.' },
      { status: 403 },
    )

    const error = await failure(apply(await write(source)))

    expect(error.message).toBe('Config is not enabled for Acme')
    expect(error.hint).toContain('enable it')
  })

  test('keeps the generic message for other 403s', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      { error: 'NotPermitted', detail: 'Not permitted' },
      { status: 403 },
    )

    const error = await failure(apply(await write(source)))

    expect(error.message).toBe('You do not have access to Acme')
    expect(error.hint).toContain('meters:write')
  })

  test('reports other API failures', async () => {
    api.routes[`POST ${applyUrl}`] = new Response(null, { status: 500 })

    const error = await failure(apply(await write(source)))

    expect(error._tag).toBe('BillingConfigError')
  })
})
