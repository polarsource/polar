import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { api } from 'polarkit'
import { useAuth } from 'polarkit/hooks'
import InitLayout from 'components/Dashboard/InitLayout'

const isGithubCallback = (query) => {
  return query.provider === 'github' && query.code && query.state
}

const InitSessionPage: NextPageWithLayout = ({ query }) => {
  const router = useRouter()
  const { session } = useAuth()

  useEffect(() => {
    if (session.authenticated) {
      router.push('/dashboard')
      return
    }

    if (!isGithubCallback(query)) {
      router.push('/')
      return
    }

    const createSession = async () => {
      return await api.integrations
        .githubCallback({
          code: query.code,
          state: query.state,
        })
        .then((res) => {
          if (res.authenticated) {
            window.location.replace('/dashboard')
          }
        })
        .catch((error) => {
          console.log('error', error)
        })
    }
    createSession()
  }, [])

  return <h1>Authenticating...</h1>
}

InitSessionPage.getLayout = (page: ReactElement) => {
  return <InitLayout>{page}</InitLayout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default InitSessionPage
