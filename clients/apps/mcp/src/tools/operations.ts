import {
  fromJsonSchema,
  type JsonSchemaType,
  type McpServer,
} from '@modelcontextprotocol/server'
import { Effect } from 'effect'
import { HttpClient, HttpClientRequest, type HttpMethod } from 'effect/http'
import generatedTools from '../generated/tools.json'
import type { PolarApiOutboundProps } from '../outbound'
import { makeToolRunner, ToolError } from '../results'

type Arguments = Record<string, unknown>

interface OperationTool {
  name: string
  title: string
  description: string
  method: HttpMethod.HttpMethod
  path: string
  queryParameters: string[]
  inputSchema: JsonSchemaType
}

const operationTools = (generatedTools as unknown as OperationTool[]).map(
  (tool) => ({
    definition: tool,
    inputSchema: fromJsonSchema<Arguments>(tool.inputSchema),
    annotations: {
      readOnlyHint: tool.method === 'GET',
      destructiveHint: tool.method === 'DELETE',
      openWorldHint: true,
    },
  }),
)

const buildUrl = (
  apiUrl: string,
  { path: pathTemplate, queryParameters }: OperationTool,
  args: Arguments,
) => {
  const path = pathTemplate.replace(/\{([^}]+)\}/g, (_, name: string) =>
    encodeURIComponent(String(args[name])),
  )
  const url = new URL(path, apiUrl)
  const append = (name: string, value: unknown) => {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) {
        url.searchParams.append(name, String(item))
      }
    }
  }
  for (const name of queryParameters) {
    const value = args[name]
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, item] of Object.entries(value)) {
        append(`${name}[${key}]`, item)
      }
    } else {
      append(name, value)
    }
  }
  return url
}

export const registerOperationTools = Effect.fn('registerOperationTools')(
  function* (
    server: McpServer,
    { apiUrl, token, readOnly }: PolarApiOutboundProps,
  ) {
    const runTool = yield* makeToolRunner
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.setHeader('User-Agent', 'polar-mcp'),
        ),
      ),
    )

    const execute = Effect.fn('Operation.execute')(
      function* (definition: OperationTool, args: Arguments) {
        const request = HttpClientRequest.make(definition.method)(
          buildUrl(apiUrl, definition, args),
        )
        const response = yield* client.execute(
          args.body === undefined
            ? request
            : yield* HttpClientRequest.bodyJson(request, args.body),
        )
        const text = yield* response.text
        if (response.status < 200 || response.status >= 300) {
          return yield* new ToolError({
            message: `Polar API ${response.status}: ${text}`,
          })
        }
        return yield* Effect.try({
          try: () =>
            text ? JSON.stringify(JSON.parse(text), null, 2) : 'No content',
          catch: ToolError.fromCause,
        })
      },
      Effect.catchTags({
        HttpBodyError: (error) => Effect.fail(ToolError.fromCause(error)),
        HttpClientError: (error) =>
          Effect.fail(ToolError.fromCause(error.reason.cause ?? error)),
      }),
    )

    for (const { definition, inputSchema, annotations } of operationTools) {
      if (readOnly && definition.method !== 'GET') {
        continue
      }
      server.registerTool(
        definition.name,
        {
          title: definition.title,
          description: definition.description,
          inputSchema,
          annotations,
        },
        (args, context) =>
          runTool(execute(definition, args), context.mcpReq.signal),
      )
    }
  },
)
