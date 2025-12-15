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

export const createClientSideAPI = (token?: string): Client => {
  const api = baseCreateClient(process.env.NEXT_PUBLIC_API_URL as string, token)
  api.use(errorMiddleware)
  return api
}

export const api = createClientSideAPI()

export const createServerSideAPI = async (
  headers: NextRequest['headers'],
  cookies: ReadonlyRequestCookies,
  token?: string,
): Promise<Client> => {
  let apiHeaders = {}

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

  // When running inside GitHub Codespaces, we need to pass a token to access forwarded ports
  if (process.env.GITHUB_TOKEN) {
    apiHeaders = {
      ...apiHeaders,
      'X-Github-Token': process.env.GITHUB_TOKEN,
    }
  }

  // Use POLAR_API_URL for server-side requests (e.g., in Docker containers)
  // Fall back to NEXT_PUBLIC_API_URL for local development
  const apiUrl =
    process.env.POLAR_API_URL || (process.env.NEXT_PUBLIC_API_URL as string)

  const client = baseCreateClient(apiUrl, token, apiHeaders)

  return client
}
