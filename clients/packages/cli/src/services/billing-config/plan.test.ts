import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { Auth } from '@/services/auth'
import { plan } from '@/services/billing-config/plan'
import { loader } from '@/services/billing-config/load'
import { authenticatedClient } from '@/services/client'
import { fakeHttp } from '@/utils/test-utils/http'
import { fakeAuth } from '@/utils/test-utils/services'

const planUrl = 'https://sandbox-api.polar.sh/v1/config/plan'

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
        local: yield* authenticatedClient('local'),
      }
      const config = yield* loader(yield* FileSystem.FileSystem)(file)
      return yield* plan(clients)(config, acme)
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

describe('plan', () => {
  test('returns the planned changes and the issues mapped onto the file', async () => {
    api.routes[`POST ${planUrl}`] = Response.json({
      changes: [
        {
          resource: 'meter',
          external_id: 'tool-calls',
          action: 'created',
          diff: [{ field: 'name', before: null, after: 'Tool calls' }],
        },
        {
          resource: 'benefit',
          external_id: 'support',
          action: 'unchanged',
          diff: [],
        },
      ],
      issues: [
        {
          severity: 'warning',
          type: 'unknown_event',
          loc: ['body', 'meters', 0, 'filter', 'clauses', 0, 'value'],
          msg: 'No events with this name have been received yet.',
          input: 'tool_call',
        },
      ],
    })

    const result = await run(await write(source))

    expect(result.entries).toEqual([
      {
        section: 'meters',
        id: 'tool-calls',
        action: 'created',
        diff: [{ field: 'name', before: null, after: 'Tool calls' }],
      },
      { section: 'benefits', id: 'support', action: 'unchanged', diff: [] },
    ])
    expect(result.issues).toEqual([
      {
        severity: 'warning',
        code: 'unknown_event',
        path: 'meters.tool-calls.filter.clauses.0.value',
        message: 'No events with this name have been received yet.',
        got: '"tool_call"',
        location: { line: 5, column: 52, length: 2 },
      },
    ])
  })

  test('warns about source that reads the world before the server issues', async () => {
    api.routes[`POST ${planUrl}`] = Response.json({
      changes: [],
      issues: [
        {
          severity: 'warning',
          type: 'unknown_event',
          loc: ['body', 'meters', 0, 'filter', 'clauses', 0, 'value'],
          msg: 'No events with this name have been received yet.',
          input: 'tool_call',
        },
      ],
    })

    const result = await run(
      await write(
        [
          "const name = process.env.METER_NAME ?? 'Tool calls'",
          'export default { meters: [{ external_id: name }] }',
        ].join('\n'),
        'polar.config.ts',
      ),
    )

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'reads_environment',
      'unknown_event',
    ])
    expect(result.issues[0]).toEqual({
      severity: 'warning',
      code: 'reads_environment',
      path: 'process.env',
      message: 'Reads an environment variable',
      location: { line: 1, column: 14, length: 11 },
    })
  })

  test('stops at lint errors without asking the server', async () => {
    const result = await run(
      await write(
        [
          'const seed = Math.random()',
          "export default { meters: [{ external_id: 'tool-calls', name: String(seed) }] }",
        ].join('\n'),
        'polar.config.ts',
      ),
    )

    expect(api.urls()).toEqual([])
    expect(result.entries).toEqual([])
    expect(result.issues.map((issue) => [issue.severity, issue.code])).toEqual([
      ['error', 'reads_random'],
    ])
  })

  test('turns 422 structural errors into issues with no changes', async () => {
    api.routes[`POST ${planUrl}`] = Response.json(
      {
        error: 'RequestValidationError',
        detail: [
          {
            type: 'missing',
            loc: ['body', 'meters', 0, 'name'],
            msg: 'Field required',
          },
        ],
      },
      { status: 422 },
    )

    const result = await run(await write(source))

    expect(result.entries).toEqual([])
    expect(result.issues.map((issue) => [issue.severity, issue.code])).toEqual([
      ['error', 'missing'],
    ])
  })

  test('explains when config is not enabled', async () => {
    api.routes[`POST ${planUrl}`] = Response.json(
      { error: 'ConfigAsCodeNotEnabled', detail: 'nope' },
      { status: 403 },
    )

    const error = await failure(run(await write(source)))

    expect(error.message).toBe('Config is not enabled for Acme')
  })

  test('explains a missing route instead of blaming the organization', async () => {
    api.routes[`POST ${planUrl}`] = new Response('Not Found', { status: 404 })

    const error = await failure(run(await write(source)))

    expect(error.message).toBe(
      'Config commands are not available in sandbox yet',
    )
  })

  test('asks for the read scope on other 403s', async () => {
    api.routes[`POST ${planUrl}`] = Response.json(
      { error: 'NotPermitted', detail: 'Not permitted' },
      { status: 403 },
    )

    const error = await failure(
      run(await write(JSON.stringify({ meters: [], benefits: [] }))),
    )

    expect(error.hint).toBe(
      'The token needs the meters:read, benefits:read scopes.',
    )
  })

  test('lists settings changes first, grouped by section', async () => {
    api.routes[`POST ${planUrl}`] = Response.json({
      changes: [],
      settings: {
        action: 'updated',
        diff: [
          { field: 'payments.currency', before: 'usd', after: 'eur' },
          { field: 'payments.tax', before: 'location', after: 'inclusive' },
        ],
      },
      issues: [],
    })

    const result = await run(
      await write(
        JSON.stringify({
          settings: { payments: { currency: 'eur' } },
          meters: [],
        }),
      ),
    )

    expect(result.entries).toEqual([
      {
        section: 'settings',
        id: 'payments',
        action: 'updated',
        diff: [
          { field: 'currency', before: 'usd', after: 'eur' },
          { field: 'tax', before: 'location', after: 'inclusive' },
        ],
      },
    ])
  })

  test('asks for the organizations scope for settings', async () => {
    api.routes[`POST ${planUrl}`] = Response.json(
      { error: 'NotPermitted', detail: 'Not permitted' },
      { status: 403 },
    )

    const error = await failure(
      run(await write(JSON.stringify({ settings: {}, meters: [] }))),
    )

    expect(error.hint).toBe(
      'The token needs the meters:read, organizations:read scopes.',
    )
  })
})
