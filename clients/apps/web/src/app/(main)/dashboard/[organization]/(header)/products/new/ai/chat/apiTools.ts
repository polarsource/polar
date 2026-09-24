import { Client } from '@polar-sh/client'
import openAPISpec from '@polar-sh/client/openapi.json'
import { tool } from 'ai'
import { z } from 'zod'
import {
  buildCatalog,
  CatalogOperation,
  findOperation,
  OpenAPISpec,
  prepareRequest,
  searchOperations,
} from './apiCatalog'

const MAX_RESPONSE_LENGTH = 30_000

let cachedCatalog: CatalogOperation[] | null = null

export const getApiCatalog = (): CatalogOperation[] => {
  cachedCatalog ??= buildCatalog(openAPISpec as unknown as OpenAPISpec)
  return cachedCatalog
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

export const createApiTools = ({
  api,
  catalog,
  organizationId,
}: {
  api: Client
  catalog: CatalogOperation[]
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
    execute: async ({ query }) => ({
      operations: searchOperations(catalog, query),
    }),
  }),
  describeApi: tool({
    description:
      'Get the full definition of one or more API operations: path and query parameters, and the JSON schema of the request body. Always describe an operation before executing it.',
    inputSchema: z.object({
      operationIds: z
        .array(z.string())
        .min(1)
        .max(5)
        .describe('Operation IDs returned by searchApi'),
    }),
    execute: async ({ operationIds }) => ({
      operations: operationIds.map(
        (operationId) =>
          findOperation(catalog, operationId) ?? {
            operationId,
            error: 'Unknown operation. Use searchApi to find valid operations.',
          },
      ),
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
        return {
          error: 'Unknown operation. Use searchApi to find valid operations.',
        }
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
