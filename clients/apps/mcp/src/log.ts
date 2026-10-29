import { Context, Effect } from 'effect'
import { captureToolCall } from './analytics'
import type { ToolMode } from './clients'
import { readIntent } from './intent'
import { isRecord } from './json'
import type { ToolErrorKind } from './results'
import type { Feedback } from './tools/feedback'

const CLIENT_INFO_META = 'io.modelcontextprotocol/clientInfo'

// One line per MCP request, queried in Workers Logs, and one PostHog event per
// tool call. Neither must carry the token, tool arguments or results: they
// hold customer data. Three exceptions reach both the request log and PostHog.
// The `intent` argument, which every tool asks the agent to write without
// customer data, redacted and capped in length. The `feedback` tool's fields,
// which exist to be sent to Polar, redacted and under the same instruction.
// And engine error messages from search scripts: search runs against the
// public OpenAPI spec without network access, so it cannot reach customer
// data. The messages can still quote the script's own code, which is
// agent-written tool input. With ?telemetry=false, intent and feedback are
// not read at all; engine errors stay in the request log, which the docs say
// is kept to operate the service.
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
  intent?: string
  feedback?: Feedback
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
  scriptErrorMessage?: string
}

export class RequestLog extends Context.Service<RequestLog, RequestLogEntry>()(
  'mcp/RequestLog',
) {}

const rpcFields = (
  body: unknown,
  telemetry: boolean,
): Partial<RequestLogEntry> => {
  if (!isRecord(body)) {
    return {}
  }
  const params = isRecord(body.params) ? body.params : {}
  const meta = isRecord(params._meta) ? params._meta : {}
  const clientInfo = params.clientInfo ?? meta[CLIENT_INFO_META]
  const args = isRecord(params.arguments) ? params.arguments : {}
  return {
    rpcMethod: typeof body.method === 'string' ? body.method : undefined,
    tool:
      body.method === 'tools/call' && typeof params.name === 'string'
        ? params.name
        : undefined,
    intent:
      telemetry && body.method === 'tools/call'
        ? readIntent(args.intent)
        : undefined,
    client: isRecord(clientInfo)
      ? { name: String(clientInfo.name), version: String(clientInfo.version) }
      : undefined,
  }
}

export const readRpcFields = (request: Request, telemetry: boolean) =>
  request.method === 'POST'
    ? Effect.promise(() =>
        request
          .clone()
          .json()
          .then(
            (body) => rpcFields(body, telemetry),
            () => ({}),
          ),
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
