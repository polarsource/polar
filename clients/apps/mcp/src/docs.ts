import { Context, Effect, Layer, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import { ToolError } from './results'

export const DOCS_URL = 'https://polar.sh/docs'
const SEARCH_URL = 'https://api.mintlify.com/discovery/v1/search/polar'
const DOCS_MCP_URL = `${DOCS_URL}/mcp`
const DOCS_MCP_SEARCH_TOOL = 'search_polar'
const SEARCH_PAGE_SIZE = 8

const SearchResults = Schema.Array(
  Schema.Struct({
    content: Schema.String,
    path: Schema.String,
    metadata: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  }),
)

const DocsMcpSearchResponse = Schema.fromJsonString(
  Schema.Struct({
    result: Schema.Struct({
      content: Schema.Array(Schema.Struct({ text: Schema.String })),
    }),
  }),
)

const pagePath = (path: string) =>
  new URL(path, `${DOCS_URL}/`).pathname.replace(/^\/(docs\/)?|\.mdx?$/g, '')

const eventStreamData = (text: string) =>
  text.startsWith('event:') || text.startsWith('data:')
    ? (text
        .split('\n')
        .find((line) => line.startsWith('data:'))
        ?.slice(5) ?? '')
    : text

export class Docs extends Context.Service<
  Docs,
  {
    readonly search: (query: string) => Effect.Effect<string, ToolError>
    readonly readPage: (path: string) => Effect.Effect<string, ToolError>
  }
>()('mcp/Docs') {
  static layer(searchKey: string | undefined) {
    return Layer.effect(
      Docs,
      Effect.gen(function* () {
        const client = (yield* HttpClient.HttpClient).pipe(
          HttpClient.filterStatusOk,
        )
        const toToolError = Effect.mapError(ToolError.fromCause)

        const searchApi = Effect.fn('Docs.searchApi')(function* (
          query: string,
          key: string,
        ) {
          const request = yield* HttpClientRequest.post(SEARCH_URL).pipe(
            HttpClientRequest.bearerToken(key),
            HttpClientRequest.bodyJson({ query, pageSize: SEARCH_PAGE_SIZE }),
          )
          const results = yield* client
            .execute(request)
            .pipe(
              Effect.flatMap(HttpClientResponse.schemaBodyJson(SearchResults)),
            )
          return results.map(({ content, path, metadata }) => {
            const page = pagePath(path)
            const title =
              typeof metadata?.title === 'string' ? metadata.title : page
            return `## ${title}\nPage: ${page}\nURL: ${DOCS_URL}/${page}\n\n${content}`
          })
        }, toToolError)

        const searchDocsMcp = Effect.fn('Docs.searchDocsMcp')(function* (
          query: string,
        ) {
          const request = yield* HttpClientRequest.post(DOCS_MCP_URL).pipe(
            HttpClientRequest.setHeader(
              'Accept',
              'application/json, text/event-stream',
            ),
            HttpClientRequest.bodyJson({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: { name: DOCS_MCP_SEARCH_TOOL, arguments: { query } },
            }),
          )
          const response = yield* client.execute(request)
          const { result } = yield* Schema.decodeUnknownEffect(
            DocsMcpSearchResponse,
          )(eventStreamData(yield* response.text))
          return result.content.map(({ text }) => text)
        }, toToolError)

        const search = Effect.fn('Docs.search')(function* (query: string) {
          const results = searchKey
            ? yield* searchApi(query, searchKey)
            : yield* searchDocsMcp(query)
          return results.length === 0
            ? 'No results'
            : results.join('\n\n---\n\n')
        })

        const readPage = Effect.fn('Docs.readPage')(
          function* (path: string) {
            const url = new URL(`${pagePath(path)}.md`, `${DOCS_URL}/`)
            if (!url.href.startsWith(`${DOCS_URL}/`)) {
              return yield* new ToolError({
                message: `Not a Polar docs page: ${path}`,
              })
            }
            const response = yield* client.get(url)
            return yield* response.text
          },
          Effect.catchTag('HttpClientError', (error) =>
            Effect.fail(ToolError.fromCause(error)),
          ),
        )

        return Docs.of({ search, readPage })
      }),
    )
  }
}
