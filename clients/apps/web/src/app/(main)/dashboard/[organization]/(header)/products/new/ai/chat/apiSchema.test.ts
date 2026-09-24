import { describe, expect, it } from 'vitest'
import { buildCatalog, findOperation } from './apiCatalog'
import {
  buildToolInputSchema,
  compactSchemas,
  shortenDescription,
} from './apiSchema'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

describe('compactSchemas', () => {
  const schemas = {
    Price: { title: 'Price', properties: { amount: { type: 'integer' } } },
    Recurring: {
      properties: {
        title: { type: 'string' },
        prices: { type: 'array', items: ref('Price') },
        medias: { type: 'array' },
        legacy: { type: 'string', deprecated: true },
      },
    },
    OneTime: {
      properties: { prices: { type: 'array', items: ref('Price') } },
    },
    Node: { properties: { child: ref('Node') } },
  }

  it('inlines schemas used once and hoists schemas used more than once', () => {
    const { roots, $defs } = compactSchemas(
      [{ oneOf: [ref('Recurring'), ref('OneTime')] }],
      schemas,
    )

    expect(roots[0]).toEqual({
      oneOf: [
        {
          properties: {
            title: { type: 'string' },
            prices: { type: 'array', items: { $ref: '#/$defs/Price' } },
          },
        },
        {
          properties: {
            prices: { type: 'array', items: { $ref: '#/$defs/Price' } },
          },
        },
      ],
    })
    expect($defs).toEqual({
      Price: { properties: { amount: { type: 'integer' } } },
    })
  })

  it('keeps recursive schemas as references', () => {
    const { roots, $defs } = compactSchemas([ref('Node')], schemas)

    expect(roots[0]).toEqual({ $ref: '#/$defs/Node' })
    expect($defs.Node).toEqual({
      properties: { child: { $ref: '#/$defs/Node' } },
    })
  })
})

describe('shortenDescription', () => {
  it('keeps only the first paragraph', () => {
    expect(shortenDescription('First line.\n\nDetails.')).toBe('First line.')
  })

  it('cuts long paragraphs at a sentence boundary', () => {
    const description = `${'a'.repeat(200)}. ${'b'.repeat(200)}.`
    expect(shortenDescription(description)).toBe(`${'a'.repeat(200)}.`)
  })
})

describe('buildToolInputSchema', () => {
  const jsonBody = (schema: Record<string, unknown>) => ({
    content: { 'application/json': { schema } },
  })
  const catalog = buildCatalog({
    paths: {
      '/v1/products/': {
        get: {
          operationId: 'products:list',
          parameters: [
            {
              name: 'organization_id',
              in: 'query',
              schema: { type: 'string' },
            },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
        },
        post: {
          operationId: 'products:create',
          requestBody: jsonBody(ref('ProductCreate')),
        },
      },
      '/v1/products/{id}': {
        patch: {
          operationId: 'products:update',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'The product ID.',
              schema: { type: 'string' },
            },
          ],
          requestBody: jsonBody(ref('ProductUpdate')),
        },
      },
      '/v1/benefits/': {
        post: {
          operationId: 'benefits:create',
          requestBody: jsonBody({
            oneOf: [ref('BenefitCustomCreate'), ref('BenefitDiscordCreate')],
          }),
        },
      },
    },
    components: {
      schemas: {
        ProductCreate: {
          properties: {
            name: { type: 'string' },
            organization_id: { type: 'string' },
          },
          required: ['name', 'organization_id'],
        },
        ProductUpdate: { properties: { name: { type: 'string' } } },
        BenefitCustomCreate: {
          properties: { type: { type: 'string', const: 'custom' } },
        },
        BenefitDiscordCreate: {
          properties: { type: { type: 'string', const: 'discord' } },
        },
      },
    },
  })
  const inputSchemaFor = (operationId: string) =>
    buildToolInputSchema(catalog, findOperation(catalog, operationId)!)

  it('requires path parameters', () => {
    expect(inputSchemaFor('products:update')).toEqual({
      type: 'object',
      properties: {
        path: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The product ID.' },
          },
          required: ['id'],
        },
        body: { properties: { name: { type: 'string' } } },
      },
      required: ['path', 'body'],
    })
  })

  it('leaves the organization out of queries and bodies', () => {
    expect(inputSchemaFor('products:list')).toEqual({
      type: 'object',
      properties: {
        query: {
          type: 'object',
          properties: { limit: { type: 'integer' } },
          required: [],
        },
      },
      required: [],
    })
    expect(inputSchemaFor('products:create')).toMatchObject({
      properties: {
        body: { properties: { name: { type: 'string' } }, required: ['name'] },
      },
    })
  })

  it('drops unsupported variants from request body unions', () => {
    expect(inputSchemaFor('benefits:create')).toMatchObject({
      properties: {
        body: {
          oneOf: [
            { properties: { type: { type: 'string', const: 'custom' } } },
          ],
        },
      },
    })
  })
})
