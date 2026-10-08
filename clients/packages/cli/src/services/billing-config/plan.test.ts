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

    const error = await failure(run(await write(source)))

    expect(error.hint).toContain('meters:read')
  })
})
