import { NEXT_API_VERSION } from '@/utils/client'
import { Client } from '@polar-sh/client'
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
const TOOL_DEFINITIONS_TTL_MS = 60 * 60 * 1000

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

const fetchApiToolDefinitions = async (
  baseUrl: string,
): Promise<ApiToolDefinition[]> => {
  // The schema is close to the Next.js data cache's 2 MB entry limit, so the
  // tool definitions built from it are cached in memory instead.
  const response = await fetch(`${baseUrl}/${NEXT_API_VERSION}/openapi.json`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Failed to load the OpenAPI schema: ${response.status}`)
  }

  const catalog = buildCatalog((await response.json()) as OpenAPISpec)
  return catalog.operations.map((operation) => ({
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

let cachedToolDefinitions: {
  definitions: Promise<ApiToolDefinition[]>
  expiresAt: number
} | null = null

const getApiToolDefinitions = (
  baseUrl: string,
): Promise<ApiToolDefinition[]> => {
  if (!cachedToolDefinitions || cachedToolDefinitions.expiresAt <= Date.now()) {
    const definitions = fetchApiToolDefinitions(baseUrl)
    const entry = {
      definitions,
      expiresAt: Date.now() + TOOL_DEFINITIONS_TTL_MS,
    }
    cachedToolDefinitions = entry
    definitions.catch(() => {
      if (cachedToolDefinitions === entry) {
        cachedToolDefinitions = null
      }
    })
  }
  return cachedToolDefinitions.definitions
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

export const createApiTools = async ({
  api,
  organizationId,
}: {
  api: Client
  organizationId: string
}): Promise<Record<string, Tool>> =>
  Object.fromEntries(
    (await getApiToolDefinitions(api.baseUrl)).map(
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
