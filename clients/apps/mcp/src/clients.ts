import { CLIENT_INFO_META_KEY } from '@modelcontextprotocol/server'
import { Option, Schema } from 'effect'

export type ToolMode = 'codemode' | 'operations'

interface ClientInfo {
  name: string
}

const CODE_MODE_PARAM = 'codemode'

// Clients that bring their own tool search get one tool per operation;
// anything else gets the search and execute code mode tools. Clients with their
// own code mode, such as opencode v2, opt out with `?codemode=false`. Names are
// matched against `clientInfo.name` and the User-Agent product token.
const OPERATION_TOOL_CLIENTS = new Set([
  'claude-code',
  'codex-mcp-client',
  'cursor-vscode',
  'Cursor',
])

const decodeClientMessage = Schema.decodeUnknownOption(
  Schema.Struct({
    params: Schema.Struct({
      _meta: Schema.Struct({
        [CLIENT_INFO_META_KEY]: Schema.Struct({ name: Schema.String }),
      }),
    }),
  }),
)

const clientInfoFromBody = (body: unknown): ClientInfo | undefined => {
  for (const message of Array.isArray(body) ? body : [body]) {
    const decoded = decodeClientMessage(message)
    if (Option.isSome(decoded)) {
      return decoded.value.params._meta[CLIENT_INFO_META_KEY]
    }
  }
  return undefined
}

const clientInfoFromUserAgent = (
  userAgent: string | null,
): ClientInfo | undefined => {
  const name = userAgent?.match(/^([^/\s]+)\//)?.[1]
  return name ? { name } : undefined
}

export const detectClient = (request: Request, body: unknown) =>
  clientInfoFromBody(body) ??
  clientInfoFromUserAgent(request.headers.get('User-Agent'))

export const toolModeFor = (
  url: URL,
  client: ClientInfo | undefined,
): ToolMode => {
  const codeMode = url.searchParams.get(CODE_MODE_PARAM)
  if (codeMode === 'false') {
    return 'operations'
  }
  if (codeMode === 'true') {
    return 'codemode'
  }
  return client && OPERATION_TOOL_CLIENTS.has(client.name)
    ? 'operations'
    : 'codemode'
}
