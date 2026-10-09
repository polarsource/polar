import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { apply } from '@/services/billing-config/apply'
import { loader } from '@/services/billing-config/load'
import { authenticatedClient } from '@/services/client'
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

const run = (file: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const clients = {
        sandbox: yield* authenticatedClient('sandbox'),
        production: yield* authenticatedClient('production'),
      }
      const config = yield* loader(yield* FileSystem.FileSystem)(file)
      return yield* apply(clients)(config, acme)
    }).pipe(
      Effect.provide(Layer.mergeAll(BunServices.layer, api.layer)),
      Effect.provideService(Auth, fakeAuth({ environment: 'sandbox' }).auth),
    ),
  )

let directory: string

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

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected failure')
    },
    (error: unknown) =>
      error as { _tag: string; message: string; hint?: string },
  )

describe('apply', () => {
  test('posts the config for the organization and reports what happened', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json({
      changes: [
        { resource: 'meter', external_id: 'tool-calls', action: 'created' },
        { resource: 'product', external_id: 'pro', action: 'updated' },
      ],
    })

    const result = await run(await write(source))

    const [request] = api.requests
    expect(request?.headers.get('Polar-Organization')).toBe('org-1')
    expect(await request?.json()).toEqual(JSON.parse(source))
    expect(result).toEqual({
      status: 'applied',
      entries: [
        { section: 'meters', id: 'tool-calls', action: 'created', diff: [] },
        { section: 'products', id: 'pro', action: 'updated', diff: [] },
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
            input: {
              external_id: 'tool-calls',
              filter: { conjunction: 'qwe', clauses: [] },
            },
          },
        ],
      },
      { status: 422 },
    )

    const result = await run(await write(source))

    expect(result).toEqual({
      status: 'rejected',
      issues: [
        {
          severity: 'error',
          code: 'enum',
          path: 'meters.tool-calls.filter.conjunction',
          message: "Input should be 'and' or 'or'",
          got: '"qwe"',
          location: { line: 5, column: 34, length: 5 },
        },
        {
          severity: 'error',
          code: 'missing',
          path: 'meters.tool-calls.name',
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

    const result = await run(await write(source))

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') return
    expect(
      result.issues.map((issue) => [issue.severity, issue.code, issue.path]),
    ).toEqual([
      ['error', 'duplicate_external_id', 'meters.tool-calls.external_id'],
      ['warning', 'unknown_event', 'meters.tool-calls.filter.clauses.0.value'],
    ])
  })

  test('asks to retry on a concurrent change', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      { error: 'ConfigMeterConflict', detail: 'Retry.' },
      { status: 409 },
    )

    const error = await failure(run(await write(source)))

    expect(error.message).toContain('at the same time')
    expect(error.hint).toContain('again')
  })

  test('explains when config is not enabled for the organization', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      { error: 'ConfigAsCodeNotEnabled', detail: 'Config is not enabled.' },
      { status: 403 },
    )

    const error = await failure(run(await write(source)))

    expect(error.message).toBe('Config is not enabled for Acme')
    expect(error.hint).toContain('enable it')
  })

  test('keeps the generic message for other 403s', async () => {
    api.routes[`POST ${applyUrl}`] = Response.json(
      { error: 'NotPermitted', detail: 'Not permitted' },
      { status: 403 },
    )

    const error = await failure(
      run(await write(JSON.stringify({ meters: [], products: [] }))),
    )

    expect(error.message).toBe('You do not have access to Acme')
    expect(error.hint).toBe(
      'The token needs the meters:write, products:write scopes.',
    )
  })

  test('reports other API failures', async () => {
    api.routes[`POST ${applyUrl}`] = new Response(null, { status: 500 })

    const error = await failure(run(await write(source)))

    expect(error._tag).toBe('BillingConfigError')
  })
})
