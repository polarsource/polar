import { api } from '@/../../../packages/polarkit'
import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import { useAuth } from '@/hooks'
import type { NextPageWithLayout } from '@/utils/next'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import posthog from 'posthog-js'
import { ParsedUrlQuery } from 'querystring'
import { ReactElement, useEffect, useState } from 'react'

export interface PageQuery extends ParsedUrlQuery {
  provider?: string
  code?: string
  state?: string
}

const GithubAuthPage: NextPageWithLayout = () => {
  const router = useRouter()
  const query = router.query as PageQuery

  const session = useAuth()
  const [error, setError] = useState<string | null>(null)

  const exchange = async (code: string, state: string) => {
    try {
      const response = await api.integrations.githubCallback({
        code: code,
        state: state,
      })

      if (response.success) {
        await session
          .login((authenticated: boolean) => {
            if (!authenticated) {
              setError('Something went wrong logging in')
            }
          })
          .then((user) => {
            posthog.identify(`user:${user.id}`)
            router.push(response.goto_url || '/login/init')
          })
      } else {
        setError('Invalid response')
      }
    } catch (err) {
      setError('Something went wrong exchanging the OAuth code for a cookie')
    }
  }

  // Try once on page load
  useEffect(() => {
    if (query.code && query.state) {
      exchange(query.code, query.state)
    } else {
      setError('Cannot authenticate without an OAuth code and state')
    }
  }, [])

  useEffect(() => {
    // This user is already authenticated
    if (session.authenticated) {
      router.push('/login/init')
    }
  }, [session.authenticated])

  if (error) {
    return (
      <LoadingScreen animate={false}>
        <LoadingScreenError error={error} />
      </LoadingScreen>
    )
  }

  return (
    <LoadingScreen animate={true}>Brewing a fresh access token.</LoadingScreen>
  )
}

GithubAuthPage.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default GithubAuthPage
