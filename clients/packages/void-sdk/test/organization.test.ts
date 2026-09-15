import { it } from '@effect/vitest'
import assert from 'node:assert/strict'
import {
  createVoid,
  defineConfig,
  MalformedResponse,
  VoidError,
  VoidHttpError,
} from '../src/index'

const config = defineConfig({ schema: {} })

it('organization operations use the configured client without resolver requests', async () => {
  const calls: Request[] = []
  const client = createVoid(config, {
    apiUrl: 'http://void/',
    token: 'organization-token',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      calls.push(request)
      if (new URL(request.url).pathname === '/v1/void/customers/customer_1') {
        return Response.json({
          id: 'c1',
          external_id: 'customer_1',
          email: 'one@example.com',
          name: null,
          created_at: '2026-09-06T00:00:00Z',
        })
      }
      return Response.json({
        version_id: null,
        id: 'deployment_1',
        checksum: 'compiled-checksum',
        applied: true,
        entries: [],
        created_at: '2026-09-06T00:00:00Z',
      })
    },
  })
  try {
    assert.equal(calls.length, 0)
    assert.equal(
      (await client.api.customers.get('customer_1')).email,
      'one@example.com',
    )
    const deployment = await client.api.deploys.create({
      checksum: 'compiled-checksum',
      reducers: [],
      meters: [],
    })
    assert.equal(deployment.applied, true)
    assert.deepEqual(
      calls.map((request) => new URL(request.url).pathname),
      ['/v1/void/customers/customer_1', '/v1/void/deploys'],
    )
    for (const request of calls) {
      assert.equal(
        request.headers.get('authorization'),
        'Bearer organization-token',
      )
      assert.equal(request.headers.get('x-void-config'), client.checksum)
    }
  } finally {
    await client.dispose()
  }
})

it('organization operations expose HTTP, response, and transport errors without wrapping them', async () => {
  const http = createVoid(config, {
    apiUrl: 'http://void',
    token: 't',
    fetch: async () =>
      Response.json(
        { error: 'ResourceNotFound', detail: 'missing' },
        { status: 404 },
      ),
  })
  const malformed = createVoid(config, {
    apiUrl: 'http://void',
    token: 't',
    fetch: async () => Response.json({ external_id: 123 }),
  })
  const offline = createVoid(config, {
    apiUrl: 'http://void',
    token: 't',
    fetch: async () => {
      throw new TypeError('network failed')
    },
  })
  try {
    await assert.rejects(
      http.api.customers.get('missing'),
      (error: unknown) =>
        error instanceof VoidHttpError &&
        error.status === 404 &&
        error.code === 'ResourceNotFound' &&
        error.detail === 'missing',
    )
    await assert.rejects(
      malformed.api.customers.get('missing'),
      (error: unknown) => error instanceof MalformedResponse,
    )
    await assert.rejects(
      offline.api.customers.get('missing'),
      (error: unknown) =>
        error instanceof VoidError && error.reason === 'unreachable',
    )
  } finally {
    await Promise.all([http.dispose(), malformed.dispose(), offline.dispose()])
  }
})

it('the same config can be used by clients with independent organization credentials', async () => {
  const requests: Request[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    return Response.json({
      id: 'c1',
      external_id: 'customer_1',
      name: null,
      email:
        request.headers.get('authorization') === 'Bearer first'
          ? 'first@example.com'
          : 'second@example.com',
      created_at: '2026-09-06T00:00:00Z',
    })
  }
  const first = createVoid(config, {
    apiUrl: 'http://void',
    token: 'first',
    fetch,
  })
  const second = createVoid(config, {
    apiUrl: 'http://void',
    token: 'second',
    fetch,
  })
  try {
    const customers = await Promise.all([
      first.api.customers.get('customer_1'),
      second.api.customers.get('customer_1'),
    ])
    assert.deepEqual(
      customers.map((customer) => customer.email),
      ['first@example.com', 'second@example.com'],
    )
    assert.equal(first.checksum, second.checksum)
    assert.equal(first.config, second.config)
    assert.equal(requests.length, 2)
  } finally {
    await Promise.all([first.dispose(), second.dispose()])
  }
})

it('selects a deployed default version through the organization settings route', async () => {
  const version = 'f'.repeat(64)
  const requests: Request[] = []
  const client = createVoid(config, {
    apiUrl: 'http://void',
    token: 'organization-token',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      return Response.json({
        id: 'org1',
        name: 'Test',
        slug: 'test',
        created_at: '2026-09-06T00:00:00Z',
        default_version_id: request.method === 'PATCH' ? version : null,
      })
    },
  })
  try {
    assert.equal(
      (await client.api.organizations.current()).default_version_id,
      null,
    )
    assert.equal(
      (
        await client.api.organizations.updateCurrent({
          default_version_id: version,
        })
      ).default_version_id,
      version,
    )
    assert.deepEqual(
      requests.map((request) => [
        request.method,
        new URL(request.url).pathname,
      ]),
      [
        ['GET', '/v1/void/organizations/current'],
        ['PATCH', '/v1/void/organizations/current'],
      ],
    )
    assert.deepEqual(await requests[1]!.json(), { default_version_id: version })
  } finally {
    await client.dispose()
  }
})
