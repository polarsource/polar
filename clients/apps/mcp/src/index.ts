import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/server'
import { env } from 'cloudflare:workers'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { FetchHttpClient, HttpClient } from 'effect/http'
import { subjectFor } from './analytics'
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
import { allScopes, readScopes } from './spec'

export { PolarApiOutbound } from './outbound'

const OPENAI_APPS_CHALLENGE_PATH = '/.well-known/openai-apps-challenge'
const OPENAI_APPS_CHALLENGE_TOKEN =
  'ZjVpZNBFeHL9gB3r9BKCLpb68RF88tIzveJIntQm90E'

const MCP_PATH = /^\/mcp\/([^/]+)$/
const TELEMETRY_OPT_OUTS = new Set(['false', '0', 'no', 'off'])
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

  if (url.pathname === OPENAI_APPS_CHALLENGE_PATH) {
    return new Response(OPENAI_APPS_CHALLENGE_TOKEN, {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const metadataMatch = url.pathname.match(PROTECTED_RESOURCE_PATH)
  if (metadataMatch) {
    const apiUrl = servers[metadataMatch[1]]
    if (!apiUrl) {
      return new Response('Not Found', { status: 404 })
    }
    return Response.json({
      resource: `${url.origin}/mcp/${metadataMatch[1]}`,
      authorization_servers: [apiUrl],
      scopes_supported: allScopes,
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
    telemetry: !TELEMETRY_OPT_OUTS.has(
      url.searchParams.get('telemetry')?.toLowerCase() ?? '',
    ),
    userAgent: request.headers.get('User-Agent'),
  }
  const response = yield* handleMcp(request, url, props, mode).pipe(
    Effect.provideService(RequestLog, log),
  )
  return logOnCompletion(response, log, startedAt)
})

const handleMcp = Effect.fn('handleMcp')(function* (
  request: Request,
  url: URL,
  { apiUrl, readOnly }: Omit<PolarApiOutboundProps, 'token'>,
  mode: ToolMode,
) {
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
    new URL(url.pathname, url.origin),
  )
  const scopes = readOnly ? readScopes : allScopes
  const token = getBearerToken(request)
  if (!token) {
    return unauthorized(resourceMetadataUrl, scopes)
  }
  const auth = yield* Auth
  const caller = yield* auth.authenticate(apiUrl, token).pipe(
    Effect.map(
      (caller) =>
        caller ?? unauthorized(resourceMetadataUrl, scopes, 'invalid_token'),
    ),
    Effect.catchTag('AuthUnavailable', () => Effect.succeed(authUnavailable())),
  )
  if (caller instanceof Response) {
    return caller
  }
  const log = yield* RequestLog
  Object.assign(log, yield* readRpcFields(request, log.telemetry), {
    subject: yield* Effect.tryPromise(() =>
      subjectFor(caller.account ?? `token:${token}`),
    ).pipe(Effect.orElseSucceed(() => undefined)),
  })

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
