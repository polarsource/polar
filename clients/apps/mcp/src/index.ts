import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/server'
import { env } from 'cloudflare:workers'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { FetchHttpClient, HttpClient } from 'effect/http'
import { Auth, getBearerToken, unauthorized } from './auth'
import { detectClient, toolModeFor } from './clients'
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
  Layer.mergeAll(Auth.layer, Sandbox.layer(env.LOADER)).pipe(
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

const readJsonBody = (request: Request) =>
  request.method === 'POST'
    ? Effect.tryPromise(() => request.clone().json()).pipe(
        Effect.orElseSucceed(() => undefined),
      )
    : Effect.succeed(undefined)

const handle = Effect.fn('handle')(function* (request: Request) {
  const url = new URL(request.url)

  const metadataMatch = url.pathname.match(PROTECTED_RESOURCE_PATH)
  if (metadataMatch) {
    const apiUrl = servers[metadataMatch[1]]
    if (!apiUrl) {
      return new Response('Not Found', { status: 404 })
    }
    return Response.json({
      resource: `${url.origin}/mcp/${metadataMatch[1]}`,
      authorization_servers: [apiUrl],
      bearer_methods_supported: ['header'],
      resource_name: 'Polar',
    })
  }

  const mcpMatch = url.pathname.match(MCP_PATH)
  const apiUrl = mcpMatch ? servers[mcpMatch[1]] : undefined
  if (!apiUrl) {
    return new Response('Not Found', { status: 404 })
  }

  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
    new URL(url.pathname, url.origin),
  )
  const token = getBearerToken(request)
  if (!token) {
    return unauthorized(resourceMetadataUrl)
  }
  const auth = yield* Auth
  if (!(yield* auth.isTokenValid(apiUrl, token))) {
    return unauthorized(resourceMetadataUrl, 'invalid_token')
  }

  const readOnly = url.searchParams.get('readonly') === 'true'
  const body = yield* readJsonBody(request)
  const toolMode = toolModeFor(url, detectClient(request, body))
  const context = yield* Effect.context<Sandbox | HttpClient.HttpClient>()
  return yield* Effect.promise(() =>
    createMcpHandler(() =>
      Effect.runPromiseWith(context)(
        createServer({ apiUrl, token, readOnly }, toolMode),
      ),
    ).fetch(request, { parsedBody: body }),
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
