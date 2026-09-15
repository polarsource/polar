import { it } from '@effect/vitest'
import assert from 'node:assert/strict'
import { createVoid, defineConfig, VoidError } from '../src/index'

const config = defineConfig({ schema: {} })
const createdAt = '2026-09-15T00:00:00Z'
const identity = (externalId: string, parent: string | null) => ({
  id: '28b403a8-c289-4898-95d6-588c017aecae',
  external_id: externalId,
  parent_external_id: parent,
  metadata: { team: 'engineering' },
  created_at: createdAt,
})
const customer = {
  id: '659812fa-039b-4b5c-915e-c1ca80e72227',
  external_id: 'acme',
  email: 'billing@acme.example',
  name: 'Acme billing',
  created_at: createdAt,
}

it('creates and navigates identities through the public SDK without billing queries', async () => {
  const requests: Request[] = []
  const client = createVoid(config, {
    apiUrl: 'http://polar',
    token: 'polar_oat_test',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      const url = new URL(request.url)
      if (request.method === 'POST') {
        const payload = await request.clone().json()
        return Response.json(
          identity(payload.external_id, payload.parent_external_id),
          { status: 201 },
        )
      }
      if (url.pathname === '/v1/void/identities') {
        assert.equal(url.searchParams.get('parent'), 'acme')
        assert.equal(url.searchParams.get('root'), 'false')
        return Response.json([identity('alice', 'acme')])
      }
      if (url.pathname === '/v1/void/customers/acme') {
        return Response.json(customer)
      }
      return Response.json({
        ...identity('alice', 'acme'),
        chain: ['alice', 'acme'],
        children: [],
      })
    },
  })
  try {
    const root = await client.root('acme', {
      metadata: { team: 'engineering' },
    })
    const alice = await root.spawn('alice')
    assert.equal(alice.id, 'alice')
    assert.deepEqual(await alice.chain(), ['alice', 'acme'])
    assert.equal((await alice.parent())?.id, 'acme')
    assert.equal((await alice.root()).id, 'acme')
    assert.deepEqual(await alice.children(), [])
    assert.equal((await alice.customer())?.id, customer.id)
    const listed = await client.api.identities.list({
      parent: 'acme',
      root: false,
    })
    assert.deepEqual(
      listed.map((entry) => entry.external_id),
      ['alice'],
    )
    assert.deepEqual(await requests[0]?.clone().json(), {
      external_id: 'acme',
      parent_external_id: null,
      metadata: { team: 'engineering' },
    })
    assert.deepEqual(await requests[1]?.clone().json(), {
      external_id: 'alice',
      parent_external_id: 'acme',
    })
    for (const request of requests) {
      assert.ok(new URL(request.url).pathname.startsWith('/v1/void/'))
      assert.equal(
        request.headers.get('authorization'),
        'Bearer polar_oat_test',
      )
      assert.equal(request.headers.get('Polar-Version'), '2026-04')
    }
  } finally {
    await client.dispose()
  }
})

it('preserves the immutable parent check when ensuring an existing identity', async () => {
  const client = createVoid(config, {
    apiUrl: 'http://polar',
    token: 'polar_oat_test',
    fetch: async () => Response.json(identity('alice', 'original')),
  })
  try {
    await assert.rejects(
      client.ensure('alice', { parent: 'replacement' }),
      (error: unknown) =>
        error instanceof VoidError && error.reason === 'parent_mismatch',
    )
  } finally {
    await client.dispose()
  }
})

it('binds an existing Polar customer and reads its authoritative billing details', async () => {
  const requests: Request[] = []
  const client = createVoid(config, {
    apiUrl: 'http://polar',
    token: 'polar_oat_customers',
    fetch: async (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      return Response.json(
        request.method === 'GET' &&
          new URL(request.url).pathname === '/v1/void/customers'
          ? [customer]
          : customer,
        { status: request.method === 'POST' ? 201 : 200 },
      )
    },
  })
  try {
    const payload = {
      external_id: 'acme',
      customer_id: customer.id,
      email: 'caller@acme.example',
      name: 'Caller name',
    }
    const bound = await client.api.customers.create(payload)
    assert.equal(bound.id, customer.id)
    assert.equal(bound.email, customer.email)
    assert.equal(bound.name, customer.name)
    assert.equal((await client.api.customers.get('acme')).id, customer.id)
    assert.deepEqual(
      (await client.api.customers.list()).map((entry) => entry.id),
      [customer.id],
    )
    assert.deepEqual(await requests[0]?.clone().json(), payload)
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      ['/v1/void/customers', '/v1/void/customers/acme', '/v1/void/customers'],
    )
  } finally {
    await client.dispose()
  }
})

it('reads a bound customer whose native email was later cleared', async () => {
  const client = createVoid(config, {
    apiUrl: 'http://polar',
    token: 'polar_oat_customers',
    fetch: async () => Response.json({ ...customer, email: null }),
  })
  try {
    assert.equal((await client.api.customers.get('acme')).email, null)
  } finally {
    await client.dispose()
  }
})
