import { toast } from '@/components/Toast/use-toast'
import { Client, createClient, Middleware } from '@polar-sh/client'

const errorMiddleware: Middleware = {
  onError: async () => {
    toast({
      title: 'A network error occurred',
      description: 'Please try again later',
    })
  },
}

const api = createClient(process.env.NEXT_PUBLIC_API_URL as string)
api.use(errorMiddleware)

const createServerSideAPI = (
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

  const client = createClient(
    process.env.NEXT_PUBLIC_API_URL as string,
    token,
    apiHeaders,
  )

  return client
}

export { api, createServerSideAPI }
