import { create, insertMultiple, Orama, search } from '@orama/orama'
import { CatalogOperation } from './apiCatalog'

const SEARCH_SCHEMA = {
  keywords: 'string',
  summary: 'string',
  description: 'string',
} as const

export type ApiSearchIndex = Orama<typeof SEARCH_SCHEMA>

export const buildSearchIndex = async (
  operations: CatalogOperation[],
): Promise<ApiSearchIndex> => {
  const index: ApiSearchIndex = create({
    schema: SEARCH_SCHEMA,
    components: { tokenizer: { stemming: true } },
  })
  await insertMultiple(
    index,
    operations.map((operation) => ({
      id: operation.operationId,
      keywords: [
        operation.operationId,
        operation.path,
        operation.method,
        ...operation.tags,
      ]
        .join(' ')
        .replace(/[^a-zA-Z0-9]+/g, ' '),
      summary: operation.summary,
      description: operation.description,
    })),
  )
  return index
}

export const searchOperations = async (
  index: ApiSearchIndex,
  operations: CatalogOperation[],
  query: string,
  limit = 10,
) => {
  const results = await search(index, {
    term: query,
    properties: ['keywords', 'summary', 'description'],
    boost: { summary: 3, keywords: 2 },
    tolerance: 1,
    limit,
  })

  return results.hits.flatMap(({ id }) => {
    const operation = operations.find(({ operationId }) => operationId === id)
    return operation
      ? [
          {
            operationId: operation.operationId,
            method: operation.method,
            path: operation.path,
            summary: operation.summary,
          },
        ]
      : []
  })
}
