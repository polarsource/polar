import { Client } from '@polar-sh/client'
import openAPISpec from '@polar-sh/client/openapi.json'
import { jsonSchema, tool, Tool } from 'ai'
import {
  buildCatalog,
  CatalogOperation,
  ExecuteInput,
  OpenAPISpec,
  prepareRequest,
} from './apiCatalog'
import { buildToolInputSchema, shortenDescription } from './apiSchema'

const MAX_RESPONSE_LENGTH = 30_000

type ToolInput = {
  path?: ExecuteInput['pathParams']
  query?: ExecuteInput['query']
  body?: ExecuteInput['body']
}

interface ApiToolDefinition {
  name: string
  description: string
  inputSchema: ReturnType<typeof jsonSchema<ToolInput>>
  operation: CatalogOperation
}

const getToolName = (operation: CatalogOperation) =>
  operation.operationId.replace(/[^a-zA-Z0-9_-]/g, '_')

let apiToolDefinitions: ApiToolDefinition[] | null = null

const getApiToolDefinitions = (): ApiToolDefinition[] => {
  if (!apiToolDefinitions) {
    const catalog = buildCatalog(openAPISpec as unknown as OpenAPISpec)
    apiToolDefinitions = catalog.operations.map((operation) => ({
      name: getToolName(operation),
      description: [
        operation.summary,
        shortenDescription(operation.description),
        `${operation.method} ${operation.path}`,
      ]
        .filter(Boolean)
        .join('\n'),
      inputSchema: jsonSchema<ToolInput>(
        buildToolInputSchema(catalog, operation),
      ),
      operation,
    }))
  }
  return apiToolDefinitions
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

export const createApiTools = ({
  api,
  organizationId,
}: {
  api: Client
  organizationId: string
}): Record<string, Tool> =>
  Object.fromEntries(
    getApiToolDefinitions().map(
      ({ name, description, inputSchema, operation }) => [
        name,
        tool({
          description,
          inputSchema,
          providerOptions: { anthropic: { deferLoading: true } },
          execute: async ({ path, query, body }) => {
            let request
            try {
              request = prepareRequest(operation, organizationId, {
                pathParams: path,
                query,
                body,
              })
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
      ],
    ),
  )
