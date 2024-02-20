import { Configuration, HTTPHeaders, PolarAPI } from '@polar-sh/sdk'
import { cookies } from 'next/headers'

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

  return new PolarAPI(
    new Configuration({
      credentials: 'include',
      headers,
    }),
  )
}
