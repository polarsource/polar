import { WorkerEntrypoint } from 'cloudflare:workers'
import { isAllowedOperation, spec } from './spec'

export interface PolarApiOutboundProps {
  apiUrl: string
  token: string
  readOnly: boolean
}

export class PolarApiOutbound extends WorkerEntrypoint<
  Env,
  PolarApiOutboundProps
> {
  async fetch(request: Request): Promise<Response> {
    const { apiUrl, token, readOnly } = this.ctx.props
    const url = new URL(request.url)

    if (url.origin !== new URL(apiUrl).origin) {
      return forbidden(`Requests to ${url.origin} are not allowed`)
    }
    if (readOnly && request.method !== 'GET') {
      return forbidden('This connection is read-only: only GET is allowed')
    }
    if (!isAllowedOperation(request.method, url.pathname)) {
      return Response.json(
        {
          error: 'NotFound',
          detail: `${request.method} ${url.pathname} is not an operation exposed by this server. Use the search tool to find it.`,
        },
        { status: 404 },
      )
    }

    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('User-Agent', 'polar-mcp')
    headers.set('Polar-Version', spec.apiVersion)
    return fetch(new Request(request, { headers }))
  }
}

const forbidden = (message: string) =>
  Response.json({ error: 'Forbidden', detail: message }, { status: 403 })
