import { readFileSync } from 'node:fs'
import { assert, it } from '@effect/vitest'
import { promiseClientSource, type OpenApi } from '../scripts/promise-client'

it('the checked-in Promise API matches the server OpenAPI document', () => {
  const spec: OpenApi = JSON.parse(
    readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'),
  )
  assert.isTrue(
    readFileSync(
      new URL('../src/api/generated.ts', import.meta.url),
      'utf8',
    ).endsWith(promiseClientSource(spec)),
  )
})

it('new resources and actions derive methods and types without an endpoint registry', () => {
  const source = promiseClientSource({
    paths: {
      '/v1/widgets': {
        get: { operationId: 'widgets:list', parameters: [{ in: 'query' }] },
        post: {
          operationId: 'widgets:create',
          requestBody: { required: true },
        },
      },
      '/v1/widgets/{id}/parts/{part}': {
        delete: {
          operationId: 'widgets:removePart',
          parameters: [
            { in: 'path', required: true },
            { in: 'path', required: true },
          ],
        },
      },
    },
  })
  assert.include(source, '"widgets": {')
  assert.include(
    source,
    'params: NonNullable<NonNullable<Parameters<Client["widgetsList"]>[0]>[\'params\']> = {}',
  )
  assert.include(
    source,
    'payload: NonNullable<Parameters<Client["widgetsCreate"]>[0]>[\'payload\']',
  )
  assert.include(source, 'api["widgetsRemovePart"](arg0, arg1, undefined)')
})

it('rejects operation IDs that cannot be grouped instead of silently omitting endpoints', () => {
  assert.throws(
    () =>
      promiseClientSource({
        paths: { '/v1/widgets': { get: { operationId: 'listWidgets' } } },
      }),
    /resource:action/,
  )
})
