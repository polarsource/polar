import { Context, Effect, Layer, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import { ToolError } from './results'

export const DOCS_URL = 'https://polar.sh/docs'
const SEARCH_URL = 'https://api.mintlify.com/discovery/v1/search/polar'
const SEARCH_PAGE_SIZE = 8

const SearchResults = Schema.Array(
  Schema.Struct({
    content: Schema.String,
    path: Schema.String,
    metadata: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  }),
)

const pagePath = (path: string) =>
  new URL(path, `${DOCS_URL}/`).pathname.replace(/^\/(docs\/)?|\.mdx?$/g, '')

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

        const search = Effect.fn('Docs.search')(function* (query: string) {
          if (!searchKey) {
            return yield* new ToolError({
              message:
                'Docs search is not configured: set the MINTLIFY_SEARCH_KEY secret',
            })
          }
          const results = yield* searchApi(query, searchKey)
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
