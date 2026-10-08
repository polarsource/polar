import type { McpServer } from '@modelcontextprotocol/server'
import { Effect, Schema } from 'effect'
import { makeToolRunner } from '../results'
import { Sandbox } from '../sandbox'
import { spec } from '../spec'

const SEARCH_LIMITS = { cpuMs: 5_000, subRequests: 0 }

const description = `Search the Polar API OpenAPI spec (API version ${spec.apiVersion}) by writing JavaScript. The code runs in a sandbox without network access.

Available in your code:

interface Operation {
  operationId: string
  summary: string
  description: string // includes the required scopes
  tags: string[]
  parameters?: Array<{ name: string; in: 'path' | 'query'; required?: boolean; schema: unknown; description?: string }>
  requestBody?: { required?: boolean; content: Record<string, { schema: unknown }> }
  responses: Record<string, { description: string; content?: Record<string, { schema: unknown }> }>
}

declare const spec: {
  apiVersion: string
  tags: string[]
  paths: Record<string, Partial<Record<'get' | 'post' | 'patch' | 'delete', Operation>>>
  // Schemas are not inlined: { "$ref": "#/components/schemas/Product" } points to spec.schemas.Product
  schemas: Record<string, unknown>
}

Tags: ${spec.tags.join(', ')}

Your code must be an async arrow function that returns the result. Return only what you need: results are truncated past ~6,000 tokens.

Examples:

// Find operations by tag
async () => Object.entries(spec.paths).flatMap(([path, methods]) =>
  Object.entries(methods)
    .filter(([, op]) => op.tags.includes('products'))
    .map(([method, op]) => ({ method: method.toUpperCase(), path, summary: op.summary })))

// Get the request body schema of an operation
async () => {
  const op = spec.paths['/v1/products/'].post
  const ref = op.requestBody.content['application/json'].schema.$ref
  return spec.schemas[ref.split('/').pop()]
}`

export const registerSearchTool = Effect.fn('registerSearchTool')(function* (
  server: McpServer,
) {
  const runTool = yield* makeToolRunner
  const sandbox = yield* Sandbox
  server.registerTool(
    'search',
    {
      title: 'Search the Polar API',
      description,
      inputSchema: Schema.Struct({
        code: Schema.String.annotate({
          description: 'JavaScript async arrow function that searches `spec`',
        }),
      }).pipe(Schema.toStandardSchemaV1, Schema.toStandardJSONSchemaV1),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    ({ code }, context) =>
      runTool(
        sandbox.run({
          code,
          prelude: `import spec from './spec.json'`,
          modules: { 'spec.json': { json: spec } },
          globalOutbound: null,
          limits: SEARCH_LIMITS,
        }),
        context.mcpReq.signal,
      ),
  )
})
