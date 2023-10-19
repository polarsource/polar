import { Configuration, PolarAPI } from '@polar-sh/sdk'
import { cookies } from 'next/headers'
import { getServerURL } from 'polarkit/api'

export const getServerSideAPI = (): PolarAPI => {
  const cookieStore = cookies()
  return new PolarAPI(
    new Configuration({
      basePath: getServerURL(),
      credentials: 'include',
      headers: {
        Cookie: cookieStore.toString(),
      },
    }),
  )
}
