import { Configuration, HTTPHeaders, PolarAPI } from '@polar-sh/sdk'
import { cookies, headers as getOriginalHeaders } from 'next/headers'
import { cache } from 'react'
import { getServerURL } from '.'

const _getServerSideAPI = (): PolarAPI => {
  let headers: HTTPHeaders = {}

  const originalHeaders = getOriginalHeaders()
  const xForwardedFor = originalHeaders.get('X-Forwarded-For')
  if (xForwardedFor) {
    headers = {
      ...headers,
      'X-Forwarded-For': xForwardedFor,
    }
  }

  const cookieStore = cookies()
  headers = {
    ...headers,
    Cookie: cookieStore.toString(),
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

// Memoize the API instance for the duration of the request
export const getServerSideAPI = cache(_getServerSideAPI)
