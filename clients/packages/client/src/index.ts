import createOpenAPIFetchClient, {
  type FetchResponse,
  type HeadersOptions,
  type ParseAsResponse,
} from 'openapi-fetch'
import type {
  ResponseObjectMap,
  SuccessResponse,
} from 'openapi-typescript-helpers'
import type { components, paths } from './v1'

export const createClient = (
  baseUrl: string,
  token?: string,
  headers?: HeadersOptions,
) =>
  createOpenAPIFetchClient<paths>({
    baseUrl,
    credentials: 'include',
    headers: {
      ...(headers ? headers : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

export class ClientResponseError extends Error {
  error: any
  response: Response

  constructor(error: any, response: Response) {
    super(error.message)
    this.name = 'ClientResponseError'
    this.error = error
    this.response = response
  }
}

export class UnauthorizedResponseError extends ClientResponseError {
  constructor(error: any, response: Response) {
    super(error, response)
    this.name = 'UnauthorizedResponseError'
  }
}

export class NotFoundResponseError extends ClientResponseError {
  constructor(error: any, response: Response) {
    super(error, response)
    this.name = 'NotFoundResponseError'
  }
}

export class TooManyRequestsResponseError extends ClientResponseError {
  constructor(error: any, response: Response) {
    super(error, response)
    this.name = 'TooManyRequestsResponseError'
  }
}

export const unwrap = async <
  T extends Record<string | number, any>,
  Options,
  Media extends `${string}/${string}`,
>(
  p: Promise<FetchResponse<T, Options, Media>>,
  handlers?: {
    [status: number]: (response: Response) => never
  },
): Promise<
  ParseAsResponse<SuccessResponse<ResponseObjectMap<T>, Media>, Options>
> => {
  const { data, error, response } = await p
  if (handlers) {
    const handler = handlers[response.status]
    if (handler) {
      return handler(response)
    }
  }

  if (response.status === 429) {
    throw new TooManyRequestsResponseError(
      { message: 'Too Many Requests' },
      response,
    )
  }

  if (error) {
    if (response.status === 401) {
      throw new UnauthorizedResponseError(error, response)
    } else if (response.status === 404) {
      throw new NotFoundResponseError(error, response)
    }

    throw new ClientResponseError(error, response)
  }

  if (!data) {
    throw new Error('No data returned')
  }
  return data
}

export const isValidationError = (
  detail: any,
): detail is {
  loc: (string | number)[]
  msg: string
  type: string
}[] => {
  return detail && Array.isArray(detail) && detail[0].loc
}

export type { Middleware } from 'openapi-fetch'
export * as enums from './enums'
export type { components, operations, paths } from './v1'
export type schemas = components['schemas']
export type Client = ReturnType<typeof createClient>
