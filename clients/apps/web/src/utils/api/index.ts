import { Configuration, PolarAPI } from '@polar-sh/api'

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
