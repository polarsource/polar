import { toast } from '@/components/Toast/use-toast'
import {
  createClient as baseCreateClient,
  Client,
  Middleware,
} from '@polar-sh/client'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { NextRequest } from 'next/server'

const errorMiddleware: Middleware = {
  onError: async () => {
    toast({
      title: 'A network error occurred',
      description: 'Please try again later',
    })
  },
}

const CLIENT_VERSION_HEADERS = {
  'X-Polar-Client-Version': `web/${
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? 'dev'
  }`,
}

export const createClientSideAPI = (token?: string): Client => {
  const api = baseCreateClient(
    process.env.NEXT_PUBLIC_API_URL as string,
    token,
    CLIENT_VERSION_HEADERS,
  )
  api.use(errorMiddleware)
  return api
}

export const api = createClientSideAPI()

export const getSSRHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { ...CLIENT_VERSION_HEADERS }

  if (process.env.POLAR_PREVIEW_ACCESS_TOKEN) {
    headers['X-Preview-Token'] = process.env.POLAR_PREVIEW_ACCESS_TOKEN
  }

  return headers
}

export const createServerSideAPI = async (
  headers: NextRequest['headers'],
  cookies: ReadonlyRequestCookies,
  token?: string,
): Promise<Client> => {
  let apiHeaders: Record<string, string> = { ...CLIENT_VERSION_HEADERS }

  const xForwardedFor = headers.get('X-Forwarded-For')

  if (xForwardedFor) {
    apiHeaders = {
      ...apiHeaders,
      'X-Forwarded-For': xForwardedFor,
    }
  }

  apiHeaders = {
    ...apiHeaders,
    Cookie: cookies.toString(),
  }

  // Preview environments: include access token so SSR calls pass through the funnel gate
  if (process.env.POLAR_PREVIEW_ACCESS_TOKEN) {
    apiHeaders = {
      ...apiHeaders,
      'X-Preview-Token': process.env.POLAR_PREVIEW_ACCESS_TOKEN,
    }
  }

  // Use POLAR_API_URL for server-side requests (e.g., in Docker containers)
  // Fall back to NEXT_PUBLIC_API_URL for local development
  const apiUrl =
    process.env.POLAR_API_URL || (process.env.NEXT_PUBLIC_API_URL as string)

  const client = baseCreateClient(apiUrl, token, apiHeaders)

  return client
}
