import createOpenAPIFetchClient, {
  type FetchResponse,
  type HeadersOptions,
  type ParseAsResponse,
} from 'openapi-fetch'
import type {
  ResponseObjectMap,
  SuccessResponse,
} from 'openapi-typescript-helpers'
import type { paths } from './v1'

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
  if (error) {
    throw new Error(error)
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
export type { components, operations } from './v1'
export type Client = ReturnType<typeof createClient>
