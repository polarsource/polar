import { Context, Effect } from 'effect'
import type { ToolMode } from './clients'
import type { ToolErrorKind } from './results'

const CLIENT_INFO_META = 'io.modelcontextprotocol/clientInfo'

// One line per MCP request, queried in Workers Logs. It must never carry the
// token, tool arguments or results: they hold customer data.
export interface RequestLogEntry {
  event: 'mcp.request'
  server: string
  mode: ToolMode
  readOnly: boolean
  userAgent: string | null
  rpcMethod?: string
  tool?: string
  client?: { name: string; version: string }
  status?: number
  durationMs?: number
  isError?: boolean
  errorKind?: ToolErrorKind
  errorMessage?: string
  apiStatus?: number
  resultChars?: number
  truncated?: boolean
  apiRequests?: number
}

export class RequestLog extends Context.Service<RequestLog, RequestLogEntry>()(
  'mcp/RequestLog',
) {}

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const rpcFields = (body: unknown): Partial<RequestLogEntry> => {
  if (!isObject(body)) {
    return {}
  }
  const params = isObject(body.params) ? body.params : {}
  const meta = isObject(params._meta) ? params._meta : {}
  const clientInfo = params.clientInfo ?? meta[CLIENT_INFO_META]
  return {
    rpcMethod: typeof body.method === 'string' ? body.method : undefined,
    tool:
      body.method === 'tools/call' && typeof params.name === 'string'
        ? params.name
        : undefined,
    client: isObject(clientInfo)
      ? { name: String(clientInfo.name), version: String(clientInfo.version) }
      : undefined,
  }
}

export const readRpcFields = (request: Request) =>
  request.method === 'POST'
    ? Effect.promise(() =>
        request
          .clone()
          .json()
          .then(rpcFields, () => ({})),
      )
    : Effect.succeed({})

// Tool results can be streamed as server-sent events, so the outcome is only
// known once the response body has been sent.
export const logOnCompletion = (
  response: Response,
  entry: RequestLogEntry,
  startedAt: number,
) => {
  const write = () =>
    console.log({
      ...entry,
      status: response.status,
      durationMs: Date.now() - startedAt,
    })
  if (!response.body) {
    write()
    return response
  }
  return new Response(
    response.body.pipeThrough(new TransformStream({ flush: write })),
    response,
  )
}
