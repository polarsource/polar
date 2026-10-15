import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/server'
import { env } from 'cloudflare:workers'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { FetchHttpClient, HttpClient } from 'effect/http'
import { Auth, authUnavailable, getBearerToken, unauthorized } from './auth'
import { type ToolMode, toolModeFor } from './clients'
import { Docs } from './docs'
import {
  logOnCompletion,
  readRpcFields,
  RequestLog,
  type RequestLogEntry,
} from './log'
import type { PolarApiOutboundProps } from './outbound'
import { createServer } from './server'
import { Sandbox } from './sandbox'

export { PolarApiOutbound } from './outbound'

const MCP_PATH = /^\/mcp\/([^/]+)$/
const PROTECTED_RESOURCE_PATH =
  /^\/\.well-known\/oauth-protected-resource\/mcp\/([^/]+)$/

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, Last-Event-ID, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}

const servers: Record<string, string | undefined> = env.POLAR_SERVERS
const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    Auth.layer,
    Sandbox.layer(env.LOADER),
    Docs.layer(env.MINTLIFY_SEARCH_KEY),
  ).pipe(
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provide(Layer.succeed(HttpClient.TracerDisabledWhen, () => true)),
  ),
)

const resourceUrl = (origin: string, server: string) =>
  `${origin}/mcp/${server}`

const withCors = (response: Response) => {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const handle = Effect.fn('handle')(function* (request: Request) {
  const url = new URL(request.url)

  const metadataMatch = url.pathname.match(PROTECTED_RESOURCE_PATH)
  if (metadataMatch) {
    const apiUrl = servers[metadataMatch[1]]
    if (!apiUrl) {
      return new Response('Not Found', { status: 404 })
    }
    return Response.json({
      resource: resourceUrl(url.origin, metadataMatch[1]),
      authorization_servers: [apiUrl],
      bearer_methods_supported: ['header'],
      resource_name: 'Polar',
    })
  }

  const server = url.pathname.match(MCP_PATH)?.[1]
  const apiUrl = server ? servers[server] : undefined
  if (!server || !apiUrl) {
    return new Response('Not Found', { status: 404 })
  }

  const startedAt = Date.now()
  const props = {
    apiUrl,
    readOnly: url.searchParams.get('readonly') === 'true',
  }
  const mode = toolModeFor(url)
  const log: RequestLogEntry = {
    event: 'mcp.request',
    server,
    mode,
    readOnly: props.readOnly,
    userAgent: request.headers.get('User-Agent'),
  }
  const response = yield* handleMcp(
    request,
    resourceUrl(url.origin, server),
    props,
    mode,
  ).pipe(Effect.provideService(RequestLog, log))
  return logOnCompletion(response, log, startedAt)
})

const handleMcp = Effect.fn('handleMcp')(function* (
  request: Request,
  resource: string,
  { apiUrl, readOnly }: Omit<PolarApiOutboundProps, 'token'>,
  mode: ToolMode,
) {
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
    new URL(resource),
  )
  const token = getBearerToken(request)
  if (!token) {
    return unauthorized(resourceMetadataUrl)
  }
  const auth = yield* Auth
  const rejection = yield* auth.isTokenValid(apiUrl, token, resource).pipe(
    Effect.map((valid) =>
      valid ? undefined : unauthorized(resourceMetadataUrl, 'invalid_token'),
    ),
    Effect.catchTag('AuthUnavailable', () => Effect.succeed(authUnavailable())),
  )
  if (rejection) {
    return rejection
  }
  Object.assign(yield* RequestLog, yield* readRpcFields(request))

  const context = yield* Effect.context<
    Sandbox | Docs | HttpClient.HttpClient | RequestLog
  >()
  return yield* Effect.promise(() =>
    createMcpHandler(() =>
      Effect.runPromiseWith(context)(
        createServer({ apiUrl, token, readOnly }, mode),
      ),
    ).fetch(request),
  )
})

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') {
      return Promise.resolve(
        new Response(null, { status: 204, headers: CORS_HEADERS }),
      )
    }
    return runtime.runPromise(handle(request).pipe(Effect.map(withCors)), {
      signal: request.signal,
    })
  },
} satisfies ExportedHandler<Env>
