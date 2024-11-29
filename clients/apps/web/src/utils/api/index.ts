import { Configuration, PolarAPI } from '@polar-sh/sdk'

export { QueryClient, QueryClientProvider } from '@tanstack/react-query'
export { queryClient } from './query'

export const getServerURL = (path?: string): string => {
  path = path || ''
  const baseURL = process.env.NEXT_PUBLIC_API_URL
  return `${baseURL}${path}`
}

export const api = new PolarAPI(
  new Configuration({
    basePath: getServerURL(),
    credentials: 'include',
  }),
)

export const buildAPI = (opts: { token?: string }) =>
  new PolarAPI(
    new Configuration({
      basePath: getServerURL(),
      credentials: 'include',
      accessToken: opts.token,
    }),
  )

export const buildServerSideAPI = (
  headers: Headers,
  cookies: any,
): PolarAPI => {
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

  return new PolarAPI(
    new Configuration({
      basePath: getServerURL(),
      credentials: 'include',
      headers: apiHeaders,
    }),
  )
}
