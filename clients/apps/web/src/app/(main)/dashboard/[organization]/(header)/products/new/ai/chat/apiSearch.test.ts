import openAPISpec from '@polar-sh/client/openapi.json'
import { describe, expect, it } from 'vitest'
import { buildCatalog, OpenAPISpec } from './apiCatalog'
import { buildSearchIndex, searchOperations } from './apiSearch'

describe('searchOperations', async () => {
  const { operations } = buildCatalog(openAPISpec as unknown as OpenAPISpec)
  const index = await buildSearchIndex(operations)

  it.each([
    ['create a benefit', 'benefits:create'],
    ['attach benefits to a product', 'products:update_benefits'],
    ['list meters', 'meters:list'],
    ['updating products', 'products:update'],
    ['creat meter', 'meters:create'],
  ])('finds the right operation for "%s"', async (query, operationId) => {
    const [first] = await searchOperations(index, operations, query)
    expect(first.operationId).toBe(operationId)
  })

  it('returns nothing when no operation matches', async () => {
    expect(await searchOperations(index, operations, 'zzzz')).toEqual([])
  })
})
