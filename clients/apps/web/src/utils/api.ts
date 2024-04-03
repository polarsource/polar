import { Configuration, HTTPHeaders, PolarAPI } from '@polar-sh/sdk'
import { cookies } from 'next/headers'
import { getServerURL } from 'polarkit/api'

export const getServerSideAPI = (token?: string): PolarAPI => {
  let headers: HTTPHeaders | undefined

  if (token) {
    headers = {
      Authorization: `Bearer ${token}`,
    }
  } else {
    const cookieStore = cookies()
    headers = {
      Cookie: cookieStore.toString(),
    }
  }

  // When running inside GitHub Codespaces, we need to pass a token to access forwarded ports
  if (process.env.GITHUB_TOKEN) {
    headers = {
      ...headers,
      'X-Github-Token': process.env.GITHUB_TOKEN,
    }
  }

  return new PolarAPI(
    new Configuration({
      basePath: getServerURL(),
      credentials: 'include',
      headers,
    }),
  )
}
