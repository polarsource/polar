import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'vitest'
import {
  createVoid,
  defineConfig,
  VoidError,
  VoidHttpError,
} from '../src/index'
import type { OpenApi } from '../scripts/promise-client'

const config = defineConfig({ schema: {} })

it('every generated request stays under the Void namespace', () => {
  const contract: OpenApi = JSON.parse(
    readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'),
  )
  const generated = readFileSync(
    new URL('../src/api/generated.ts', import.meta.url),
    'utf8',
  )
  const paths = [...generated.matchAll(/HttpClientRequest\.\w+\(`([^`]+)`\)/g)]
  assert.ok(paths.length > 0)
  assert.equal(
    paths.length,
    Object.values(contract.paths).flatMap((item) =>
      Object.values(item).filter((operation) => operation?.operationId),
    ).length,
  )
  assert.ok(
    Object.keys(contract.paths).every((path) => path.startsWith('/v1/void/')),
  )
  assert.ok(paths.every(([, path]) => path?.startsWith('/v1/void/')))
})

it('pending operations send Polar credentials only to Void routes and preserve SDK errors', async () => {
  const requests: Request[] = []
  const client = createVoid(config, {
    apiUrl: 'http://polar/',
    token: 'polar_oat_test',
    fetch: async (input, init) => {
      requests.push(new Request(input, init))
      return Response.json({ detail: 'Not Found' }, { status: 404 })
    },
  })
  try {
    for (const request of [
      () => client.api.events.ingest([]),
      () => client.api.products.list(),
      () => client.api.customers.list(),
      () => client.api.subscriptions.list(),
    ]) {
      await assert.rejects(request(), (error: unknown) => {
        assert.ok(error instanceof VoidHttpError)
        assert.equal(error.status, 404)
        assert.equal(error.code, 'Unknown')
        assert.equal(error.detail, 'Not Found')
        assert.ok(!error.path.startsWith('/void'))
        return true
      })
    }
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      [
        '/v1/void/events',
        '/v1/void/products',
        '/v1/void/customers',
        '/v1/void/subscriptions',
      ],
    )
    for (const request of requests) {
      assert.equal(
        request.headers.get('authorization'),
        'Bearer polar_oat_test',
      )
      assert.equal(request.headers.get('Polar-Version'), '2026-04')
      assert.equal(request.headers.get('x-void-config'), client.checksum)
    }
  } finally {
    await client.dispose()
  }
})

it.each([
  { status: 401, error: 'Unauthorized', detail: 'Unauthorized' },
  { status: 403, error: 'NotPermitted', detail: 'Not permitted' },
  {
    status: 422,
    error: 'RequestValidationError',
    detail: [
      {
        loc: ['query', 'limit'],
        msg: 'Input should be greater than 0',
        type: 'greater_than',
      },
    ],
  },
])(
  'maps Polar $status errors without losing their detail',
  async ({ status, error, detail }) => {
    const client = createVoid(config, {
      apiUrl: 'http://polar',
      token: 'polar_oat_test',
      fetch: async () => Response.json({ error, detail }, { status }),
    })
    try {
      await assert.rejects(
        client.api.organizations.current(),
        (cause: unknown) => {
          assert.ok(cause instanceof VoidHttpError)
          assert.equal(cause.status, status)
          assert.equal(cause.code, error)
          assert.equal(cause.path, '/organizations/current')
          assert.deepEqual(cause.detail, detail)
          return true
        },
      )
    } finally {
      await client.dispose()
    }
  },
)

it.each([
  '../../customers',
  '../../../v1/events',
  '%2e%2e/%2e%2e/customers',
  '.%2e/%2e./products',
])(
  'rejects namespace traversal in path parameter %s before sending credentials',
  async (externalId) => {
    let requests = 0
    const client = createVoid(config, {
      apiUrl: 'http://polar',
      token: 'polar_oat_test',
      fetch: async () => {
        requests += 1
        return Response.json({ detail: 'Not Found' }, { status: 404 })
      },
    })
    try {
      await assert.rejects(
        client.api.customers.get(externalId),
        (cause: unknown) => {
          assert.ok(cause instanceof VoidError)
          assert.equal(cause.reason, 'invalid_argument')
          return true
        },
      )
      assert.equal(requests, 0)
    } finally {
      await client.dispose()
    }
  },
)
