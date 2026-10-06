import { Context, Data, Effect, Layer, Schema } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'
import type { AuthError, PolarEnvironment } from '@/schemas/Auth'
import { apiUrl, describeApiFailure } from '@/services/api'
import { type ApiClient, authenticatedClient } from '@/services/client'

export class SearchError extends Data.TaggedError('SearchError')<{
  message: string
  hint?: string
}> {}

const SearchResultSchema = Schema.Struct({
  operation_id: Schema.String,
  method: Schema.String,
  path: Schema.String,
  summary: Schema.String,
  cli_command: Schema.NullOr(Schema.String),
  probability: Schema.Number,
})
export type SearchResult = typeof SearchResultSchema.Type

const SearchUsageSchema = Schema.Struct({
  input_tokens: Schema.Number,
  output_tokens: Schema.Number,
  cost_usd: Schema.NullOr(Schema.Number),
})
export type SearchUsage = typeof SearchUsageSchema.Type

const SearchResponseSchema = Schema.Struct({
  query: Schema.String,
  model: Schema.String,
  confidence: Schema.Number,
  usage: SearchUsageSchema,
  results: Schema.Array(SearchResultSchema),
})
export type SearchResponse = typeof SearchResponseSchema.Type

const UnavailableSchema = Schema.Struct({ detail: Schema.String })

export interface SearchRequest {
  query: string
  limit: number
}

export class Search extends Context.Service<
  Search,
  {
    search: (
      environment: PolarEnvironment,
      request: SearchRequest,
    ) => Effect.Effect<SearchResponse, AuthError | SearchError>
  }
>()('Search') {}

const apiFailure = (status: number, environment: PolarEnvironment) => {
  const { message, hint } = describeApiFailure(status, environment)
  return hint
    ? new SearchError({ message, hint })
    : new SearchError({ message })
}

export const make = Effect.gen(function* () {
  const clients: Record<PolarEnvironment, ApiClient> = {
    sandbox: yield* authenticatedClient('sandbox'),
    production: yield* authenticatedClient('production'),
  }

  const search = (environment: PolarEnvironment, request: SearchRequest) =>
    Effect.gen(function* () {
      const httpRequest = yield* HttpClientRequest.post(
        yield* apiUrl(environment, '/cli/search'),
      ).pipe(HttpClientRequest.bodyJson(request))
      const response = yield* clients[environment].execute(httpRequest)

      if (response.status === 503) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(UnavailableSchema)(response)
        return yield* new SearchError({
          message: 'API search is not available right now',
          hint: body.detail,
        })
      }
      if (response.status !== 200) {
        return yield* apiFailure(response.status, environment)
      }
      return yield* HttpClientResponse.schemaBodyJson(SearchResponseSchema)(
        response,
      )
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: (error) =>
          new SearchError({
            message: 'Could not reach the Polar API',
            hint: error.message,
          }),
        HttpBodyError: () =>
          new SearchError({ message: 'Could not encode the request' }),
        SchemaError: () =>
          new SearchError({ message: 'Unexpected response from the API' }),
      }),
    )

  return Search.of({ search })
})

export const layer = Layer.effect(Search, make)
