import {
  fromJsonSchema,
  type JsonSchemaType,
  type McpServer,
} from '@modelcontextprotocol/server'
import generatedTools from '../generated/tools.json'
import type { PolarApiOutboundProps } from '../outbound'
import { toolError, toolResult } from '../results'

type Arguments = Record<string, unknown>

interface OperationTool {
  name: string
  title: string
  description: string
  method: string
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

export const registerOperationTools = (
  server: McpServer,
  { apiUrl, token, readOnly }: PolarApiOutboundProps,
) => {
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
      async (args) => {
        try {
          const response = await fetch(buildUrl(apiUrl, definition, args), {
            method: definition.method,
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'polar-mcp',
              ...(args.body === undefined
                ? {}
                : { 'Content-Type': 'application/json' }),
            },
            body:
              args.body === undefined ? undefined : JSON.stringify(args.body),
          })
          const text = await response.text()
          if (!response.ok) {
            throw new Error(`Polar API ${response.status}: ${text}`)
          }
          return toolResult(
            text ? JSON.stringify(JSON.parse(text), null, 2) : 'No content',
          )
        } catch (error) {
          return toolError(error)
        }
      },
    )
  }
}
