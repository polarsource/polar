import { GetServerSidePropsContext } from 'next'
import { PolarAPI } from 'polarkit/api/client'
import { getServerURL } from 'polarkit/utils'

export const serversideAPI = (context: GetServerSidePropsContext): PolarAPI => {
  return new PolarAPI({
    BASE: getServerURL(),
    HEADERS: {
      Cookie: context.req.headers.cookie || '',
    },
  })
}
