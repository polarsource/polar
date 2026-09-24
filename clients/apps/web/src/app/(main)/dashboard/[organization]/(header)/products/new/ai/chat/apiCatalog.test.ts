import { describe, expect, it } from 'vitest'
import {
  buildCatalog,
  findOperation,
  OpenAPISpec,
  prepareRequest,
  searchOperations,
} from './apiCatalog'

const spec: OpenAPISpec = {
  paths: {
    '/v1/products/': {
      get: {
        operationId: 'products:list',
        summary: 'List Products',
        tags: ['products'],
        parameters: [
          { name: 'organization_id', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
      },
      post: {
        operationId: 'products:create',
        summary: 'Create Product',
        tags: ['products'],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductCreate' },
            },
          },
        },
      },
    },
    '/v1/products/{id}': {
      patch: {
        operationId: 'products:update',
        summary: 'Update Product',
        tags: ['products'],
        parameters: [{ name: 'id', in: 'path', required: true }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductUpdate' },
            },
          },
        },
      },
      delete: {
        operationId: 'products:delete',
        summary: 'Delete Product',
        tags: ['products'],
      },
    },
    '/v1/meters/': {
      get: {
        operationId: 'meters:list',
        summary: 'List Meters',
        tags: ['meters'],
      },
    },
  },
  components: {
    schemas: {
      ProductCreate: {
        oneOf: [{ $ref: '#/components/schemas/ProductCreateOneTime' }],
      },
      ProductCreateOneTime: {
        title: 'ProductCreateOneTime',
        properties: {
          title: { type: 'string' },
          name: { type: 'string', examples: ['Pro'] },
          organization_id: { type: 'string' },
          parent: { $ref: '#/components/schemas/ProductCreateOneTime' },
        },
      },
      ProductUpdate: { properties: { name: { type: 'string' } } },
    },
  },
}

const catalog = buildCatalog(spec)

describe('buildCatalog', () => {
  it('only includes allowed operations', () => {
    expect(catalog.map(({ operationId }) => operationId).sort()).toEqual([
      'meters:list',
      'products:create',
      'products:list',
      'products:update',
    ])
  })

  it('dereferences schemas without dropping properties named like stripped keys', () => {
    const [variant] = findOperation(catalog, 'products:create')!.requestBody!
      .oneOf as Record<string, Record<string, Record<string, unknown>>>[]

    expect(variant.title).toBeUndefined()
    expect(variant.properties.title).toEqual({ type: 'string' })
    expect(variant.properties.name).toEqual({ type: 'string' })
    expect(variant.properties.parent).toEqual({
      type: 'object',
      description: 'A ProductCreateOneTime object.',
    })
  })
})

describe('searchOperations', () => {
  it('ranks matching operations first', () => {
    const [first] = searchOperations(catalog, 'create a product')
    expect(first.operationId).toBe('products:create')
  })

  it('returns all operations when nothing matches', () => {
    expect(searchOperations(catalog, 'zzz')).toHaveLength(catalog.length)
  })
})

describe('prepareRequest', () => {
  const organizationId = 'org-1'

  it('forces the organization on list queries and drops unknown parameters', () => {
    const request = prepareRequest(
      findOperation(catalog, 'products:list')!,
      organizationId,
      { query: { organization_id: 'other-org', limit: 5, unknown: true } },
    )

    expect(request.params.query).toEqual({
      organization_id: organizationId,
      limit: 5,
    })
  })

  it('forces the organization on request bodies that accept it', () => {
    const request = prepareRequest(
      findOperation(catalog, 'products:create')!,
      organizationId,
      { body: { name: 'Pro', organization_id: 'other-org' } },
    )

    expect(request.body).toEqual({
      name: 'Pro',
      organization_id: organizationId,
    })
  })

  it('does not add the organization to bodies that do not accept it', () => {
    const request = prepareRequest(
      findOperation(catalog, 'products:update')!,
      organizationId,
      { pathParams: { id: 'product-1' }, body: { name: 'Pro' } },
    )

    expect(request.params.path).toEqual({ id: 'product-1' })
    expect(request.body).toEqual({ name: 'Pro' })
  })

  it('rejects missing path parameters', () => {
    expect(() =>
      prepareRequest(
        findOperation(catalog, 'products:update')!,
        organizationId,
        {},
      ),
    ).toThrow('Missing required path parameter "id".')
  })
})
