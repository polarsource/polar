import openAPISpec from '@polar-sh/client/openapi.json'
import { describe, expect, it } from 'vitest'
import { buildCatalog, findOperation, OpenAPISpec } from './apiCatalog'
import {
  compactSchemas,
  describeOperation,
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

describe('describeOperation', () => {
  const catalog = buildCatalog(openAPISpec as unknown as OpenAPISpec)
  const describeById = (operationId: string, variant?: string) =>
    describeOperation(catalog, findOperation(catalog, operationId)!, variant)

  it('drops unsupported variants from request body unions', () => {
    const description = describeById('benefits:create')

    expect(
      (description as { requestBody: { oneOf: unknown[] } }).requestBody.oneOf,
    ).toHaveLength(4)
  })

  it('describes a single variant', () => {
    expect(describeById('benefits:create', 'feature_flag')).toMatchObject({
      variant: 'feature_flag',
      requestBody: {
        properties: { type: { const: 'feature_flag' } },
      },
    })
  })

  it('rejects unknown and unsupported variants', () => {
    expect(describeById('benefits:create', 'discord')).toMatchObject({
      error: expect.stringContaining('Unknown variant'),
    })
  })

  it('only lists the variants of large request body unions', () => {
    const variantNames = Array.from({ length: 20 }, (_, i) => `Variant${i}`)
    const largeCatalog = buildCatalog(
      {
        paths: {
          '/v1/things/': {
            post: {
              operationId: 'things:create',
              requestBody: {
                content: {
                  'application/json': {
                    schema: { oneOf: variantNames.map(ref) },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: Object.fromEntries(
            variantNames.map((name) => [
              name,
              {
                properties: Object.fromEntries(
                  Array.from({ length: 20 }, (_, i) => [
                    `${name}_field_${i}`,
                    { type: 'string', description: 'x'.repeat(40) },
                  ]),
                ),
              },
            ]),
          ),
        },
      },
      new Set(['things:create']),
    )

    const description = describeOperation(
      largeCatalog,
      largeCatalog.operations[0],
    )

    expect(description).toMatchObject({ variants: variantNames })
    expect(description).toHaveProperty('requestBody', undefined)
  })
})
