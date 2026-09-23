import nodeAssert from 'node:assert/strict'
import { assert, it } from '@effect/vitest'
import { createVoid, defineConfig, VoidHttpError } from '../src/index'

it('exposes stage operations with revision checks through the Promise API', async () => {
  const configuration = {
    reducers: [],
    meters: [],
    entitlements: [],
    products: [],
    activities: [],
    signals: [],
  }
  const stage = { revision: 1, configuration }
  const deployment = {
    id: 'a0000000-0000-4000-8000-000000000001',
    version_id: 'a'.repeat(64),
    checksum: 'stage:test:1',
    applied: true,
    status: 'active' as const,
    has_configuration: true,
    entries: [],
    created_at: '2026-09-22T00:00:00Z',
  }
  const responses = [
    Response.json(stage),
    Response.json(stage),
    Response.json({ ...deployment, id: null, applied: false, status: null }),
    Response.json(deployment),
    Response.json(
      { error: 'StageConflict', detail: 'The stage changed.' },
      { status: 409 },
    ),
  ]
  const requests: Request[] = []
  const client = createVoid(defineConfig({ schema: {} }), {
    apiUrl: 'http://void',
    token: 'test',
    fetch: async (input, init) => {
      requests.push(new Request(input, init))
      const response = responses.shift()
      if (!response) throw new Error('Unexpected request')
      return response
    },
  })
  try {
    const saved = await client.api.stage.save({
      expected_revision: null,
      configuration,
    })
    assert.deepEqual(saved, stage)
    assert.deepEqual(await client.api.stage.get(), stage)
    const plan = await client.api.stage.deploy({
      expected_revision: saved.revision,
      dry_run: true,
    })
    assert.isFalse(plan.applied)
    assert.deepEqual(
      await client.api.stage.deploy({
        expected_revision: saved.revision,
        activate: true,
      }),
      deployment,
    )
    await nodeAssert.rejects(
      client.api.stage.save({ expected_revision: 1, configuration }),
      (error: unknown) =>
        error instanceof VoidHttpError && error.status === 409,
    )
    assert.deepEqual(
      requests.map((r) => [
        r.method,
        new URL(r.url).pathname + new URL(r.url).search,
      ]),
      [
        ['PUT', '/v1/void/stage'],
        ['GET', '/v1/void/stage'],
        ['POST', '/v1/void/stage/deploy'],
        ['POST', '/v1/void/stage/deploy'],
        ['PUT', '/v1/void/stage'],
      ],
    )
    assert.deepEqual(await requests[0]!.json(), {
      expected_revision: null,
      configuration,
    })
    assert.deepEqual(await requests[2]!.json(), {
      expected_revision: 1,
      dry_run: true,
    })
    assert.deepEqual(await requests[3]!.json(), {
      expected_revision: 1,
      activate: true,
    })
  } finally {
    await client.dispose()
  }
})
