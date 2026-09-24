import { Client } from '@polar-sh/client'
import openAPISpec from '@polar-sh/client/openapi.json'
import { tool } from 'ai'
import { z } from 'zod'
import {
  buildCatalog,
  Catalog,
  findOperation,
  OpenAPISpec,
  prepareRequest,
} from './apiCatalog'
import { describeOperation } from './apiSchema'
import { ApiSearchIndex, buildSearchIndex, searchOperations } from './apiSearch'

const MAX_RESPONSE_LENGTH = 30_000

interface ApiContext {
  catalog: Catalog
  searchIndex: ApiSearchIndex
}

let apiContext: Promise<ApiContext> | null = null

export const getApiContext = (): Promise<ApiContext> => {
  apiContext ??= (async () => {
    const catalog = buildCatalog(openAPISpec as unknown as OpenAPISpec)
    const searchIndex = await buildSearchIndex(catalog.operations)
    return { catalog, searchIndex }
  })()
  return apiContext
}

const truncate = (data: unknown) => {
  const serialized = JSON.stringify(data) ?? ''
  if (serialized.length <= MAX_RESPONSE_LENGTH) {
    return { data }
  }
  return {
    truncated: true,
    data: serialized.slice(0, MAX_RESPONSE_LENGTH),
  }
}

export const API_TOOL_NAMES = ['searchApi', 'describeApi', 'executeApi']

const UNKNOWN_OPERATION_ERROR =
  'Unknown operation. Use searchApi to find valid operations.'

export const createApiTools = ({
  api,
  context: { catalog, searchIndex },
  organizationId,
}: {
  api: Client
  context: ApiContext
  organizationId: string
}) => ({
  searchApi: tool({
    description:
      'Search the Polar API reference for operations you can execute. Returns matching operation IDs with their HTTP method, path and summary.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Keywords describing what you want to do, e.g. "create product"',
        ),
    }),
    execute: async ({ query }) => {
      const operations = await searchOperations(
        searchIndex,
        catalog.operations,
        query,
      )
      return operations.length > 0
        ? { operations }
        : { operations, hint: 'No operations matched. Try other keywords.' }
    },
  }),
  describeApi: tool({
    description:
      'Get the definition of one or more API operations: path and query parameters, and the JSON schema of the request body. Schemas used in several places are listed once under "$defs". When a request body has several variants and no variant is given, only the variant names are returned: describe the operation again with the variant you need. Always describe an operation before executing it.',
    inputSchema: z.object({
      operations: z
        .array(
          z.object({
            operationId: z
              .string()
              .describe('Operation ID returned by searchApi'),
            variant: z
              .string()
              .optional()
              .describe('Request body variant, e.g. "feature_flag"'),
          }),
        )
        .min(1)
        .max(5),
    }),
    execute: async ({ operations }) => ({
      operations: operations.map(({ operationId, variant }) => {
        const operation = findOperation(catalog, operationId)
        return operation
          ? describeOperation(catalog, operation, variant)
          : { operationId, error: UNKNOWN_OPERATION_ERROR }
      }),
    }),
  }),
  executeApi: tool({
    description:
      'Execute a Polar API operation on behalf of the user. The organization ID is set automatically on requests that need it. Returns the HTTP status and response body; on a validation error, fix the input and try again.',
    inputSchema: z.object({
      operationId: z.string().describe('Operation ID returned by searchApi'),
      pathParams: z
        .record(z.string(), z.string())
        .optional()
        .describe('Path parameters, e.g. { "id": "..." }'),
      query: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Query parameters'),
      body: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('JSON request body, following the schema from describeApi'),
    }),
    execute: async ({ operationId, ...input }) => {
      const operation = findOperation(catalog, operationId)
      if (!operation) {
        return { error: UNKNOWN_OPERATION_ERROR }
      }

      let request
      try {
        request = prepareRequest(operation, organizationId, input)
      } catch (error) {
        return { error: (error as Error).message }
      }

      const { data, error, response } = await api.request(
        request.method as never,
        request.path as never,
        { params: request.params, body: request.body } as never,
      )

      return {
        status: response.status,
        ...truncate(response.ok ? data : error),
      }
    },
  }),
})
