import openAPISpec from '@polar-sh/client/openapi.json'
import { describe, expect, it } from 'vitest'
import { buildCatalog, findOperation, OpenAPISpec } from './apiCatalog'
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
  const catalog = buildCatalog(openAPISpec as unknown as OpenAPISpec)
  const inputSchemaFor = (operationId: string) =>
    buildToolInputSchema(catalog, findOperation(catalog, operationId)!)

  it('requires path parameters', () => {
    expect(inputSchemaFor('products:update')).toMatchObject({
      properties: {
        path: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      required: ['path', 'body'],
    })
  })

  it('leaves the organization out of queries and bodies', () => {
    const listSchema = inputSchemaFor('products:list') as {
      properties: { query: { properties: Record<string, unknown> } }
    }
    expect(listSchema.properties.query.properties).not.toHaveProperty(
      'organization_id',
    )
    expect(JSON.stringify(inputSchemaFor('products:create'))).not.toContain(
      'organization_id',
    )
  })

  it('drops unsupported variants from request body unions', () => {
    const schema = inputSchemaFor('benefits:create') as {
      properties: { body: { oneOf: { properties: { type: unknown } }[] } }
    }

    expect(
      schema.properties.body.oneOf.map(({ properties }) => properties.type),
    ).toEqual([
      { type: 'string', const: 'custom' },
      { type: 'string', const: 'license_keys' },
      { type: 'string', const: 'meter_credit' },
      { type: 'string', const: 'feature_flag' },
    ])
  })
})
