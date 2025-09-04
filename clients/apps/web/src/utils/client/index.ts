import { toast } from '@/components/Toast/use-toast'
import {
  createClient as baseCreateClient,
  Client,
  Middleware,
} from '@polar-sh/client'

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

export const createServerSideAPI = (
  headers: Headers,
  cookies: any,
  token?: string,
): Client => {
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

  const client = baseCreateClient(
    process.env.NEXT_PUBLIC_API_URL as string,
    token,
    apiHeaders,
  )

  return client
}
