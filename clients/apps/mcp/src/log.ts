import { Context, Effect } from 'effect'
import { captureToolCall } from './analytics'
import type { ToolMode } from './clients'
import { isRecord } from './json'
import type { ToolErrorKind } from './results'

const CLIENT_INFO_META = 'io.modelcontextprotocol/clientInfo'

// One line per MCP request, queried in Workers Logs, and one PostHog event per
// tool call. It must never carry the token, tool arguments or results: they
// hold customer data. Error messages are kept only from the sandbox runtime and
// from engine errors in search scripts, which run against the public OpenAPI
// spec without network access, so they cannot see customer data.
export interface RequestLogEntry {
  event: 'mcp.request'
  server: string
  mode: ToolMode
  readOnly: boolean
  telemetry: boolean
  userAgent: string | null
  subject?: string
  rpcMethod?: string
  tool?: string
  client?: { name: string; version: string }
  status?: number
  durationMs?: number
  isError?: boolean
  errorKind?: ToolErrorKind
  errorMessage?: string
  apiStatus?: number
  apiErrorFields?: ReadonlyArray<string>
  resultChars?: number
  truncated?: boolean
  emptyResult?: boolean
  apiRequests?: number
  apiOperations?: string[]
  unexposedOperations?: string[]
  scriptError?: string
}

export class RequestLog extends Context.Service<RequestLog, RequestLogEntry>()(
  'mcp/RequestLog',
) {}

const rpcFields = (body: unknown): Partial<RequestLogEntry> => {
  if (!isRecord(body)) {
    return {}
  }
  const params = isRecord(body.params) ? body.params : {}
  const meta = isRecord(params._meta) ? params._meta : {}
  const clientInfo = params.clientInfo ?? meta[CLIENT_INFO_META]
  return {
    rpcMethod: typeof body.method === 'string' ? body.method : undefined,
    tool:
      body.method === 'tools/call' && typeof params.name === 'string'
        ? params.name
        : undefined,
    client: isRecord(clientInfo)
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
  const write = () => {
    const completed = {
      ...entry,
      status: response.status,
      durationMs: Date.now() - startedAt,
    }
    console.info({
      message: [entry.server, entry.rpcMethod, entry.tool, response.status]
        .filter(Boolean)
        .join(' '),
      ...completed,
    })
    captureToolCall(completed)
  }
  if (!response.body) {
    write()
    return response
  }
  return new Response(
    response.body.pipeThrough(new TransformStream({ flush: write })),
    response,
  )
}
