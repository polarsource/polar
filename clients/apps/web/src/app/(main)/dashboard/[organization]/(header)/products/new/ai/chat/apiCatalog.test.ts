import { describe, expect, it } from 'vitest'
import {
  buildCatalog,
  findOperation,
  OpenAPISpec,
  prepareRequest,
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
    expect(
      catalog.operations.map(({ operationId }) => operationId).sort(),
    ).toEqual([
      'meters:list',
      'products:create',
      'products:list',
      'products:update',
    ])
  })

  it('detects request bodies that accept an organization through references', () => {
    expect(
      findOperation(catalog, 'products:create')?.bodyAcceptsOrganizationId,
    ).toBe(true)
    expect(
      findOperation(catalog, 'products:update')?.bodyAcceptsOrganizationId,
    ).toBe(false)
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
