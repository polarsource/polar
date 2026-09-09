import { Layer } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'

type Handler = (request: Request) => Response | Promise<Response>

export type Routes = Record<string, Response | Handler>

export const fakeHttp = (routes: Routes = {}) => {
  const requests: Request[] = []
  const fetch = (async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const handler =
      routes[`${request.method} ${request.url}`] ?? routes[request.url]
    if (handler === undefined) {
      throw new Error(`Unexpected request: ${request.method} ${request.url}`)
    }
    return typeof handler === 'function' ? handler(request) : handler.clone()
  }) as typeof globalThis.fetch
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  )
  return {
    layer,
    fetch,
    routes,
    requests,
    urls: () => requests.map((request) => request.url),
  }
}
