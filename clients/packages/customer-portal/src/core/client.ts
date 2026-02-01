import { createClient, type Client } from '@polar-sh/client'
import {
  PolarCustomerPortalError,
  RateLimitError,
  UnauthorizedError,
} from './errors'

export interface PortalClientConfig {
  token: string
  organizationId: string
  organizationSlug?: string
  baseUrl?: string
  onUnauthorized?: () => void
}

export interface PortalClient {
  readonly config: PortalClientConfig
  readonly client: Client
  request: <T>(
    fn: (
      client: Client,
    ) => Promise<{ data?: T; error?: unknown; response: Response }>,
  ) => Promise<T>
}

export function createPortalClient(config: PortalClientConfig): PortalClient {
  const baseUrl = config.baseUrl || 'https://api.spairehq.com'
  const client = createClient(baseUrl, config.token)

  const request = async <T>(
    fn: (
      client: Client,
    ) => Promise<{ data?: T; error?: unknown; response: Response }>,
  ): Promise<T> => {
    const { data, error, response } = await fn(client)

    if (response.status === 401) {
      config.onUnauthorized?.()
      throw new UnauthorizedError()
    }

    if (response.status === 429) {
      throw new RateLimitError()
    }

    if (error) {
      throw PolarCustomerPortalError.fromResponse(error, response)
    }

    if (!data) {
      throw new PolarCustomerPortalError({
        message: 'No data returned',
        code: 'no_data',
        status: response.status,
      })
    }

    return data
  }

  return {
    config,
    client,
    request,
  }
}
