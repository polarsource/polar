import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import { useGithubOAuthCallback } from '@/hooks'
import type { NextPageWithLayout } from '@/utils/next'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { ParsedUrlQuery } from 'querystring'
import type { ReactElement } from 'react'

export interface PageQuery extends ParsedUrlQuery {
  provider?: string
  code?: string
  state?: string
}

const GithubAuthPage: NextPageWithLayout = () => {
  const router = useRouter()
  const query = router.query as PageQuery

  const { success, error, gotoUrl } = useGithubOAuthCallback(
    query.code,
    query.state,
  )

  if (success && gotoUrl) {
    router.push(gotoUrl)
    return <></>
  }

  if (success) {
    router.push('/dashboard')
    return <></>
  }

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
