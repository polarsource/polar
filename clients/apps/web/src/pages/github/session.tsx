import LoadingScreen, {
  LoadingScreenError,
} from 'components/Dashboard/LoadingScreen'
import Layout from 'components/Layout/EmptyLayout'
import { useRouter } from 'next/router'
import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import { useGithubOAuthCallback } from '../../hooks'

const GithubAuthPage: NextPageWithLayout = ({
  query,
}: {
  query: {
    provider: string
    code: string
    state: string
  }
}) => {
  const router = useRouter()
  const { success, error, gotoUrl } = useGithubOAuthCallback(
    query.code,
    query.state,
  )

  if (success && gotoUrl) {
    router.push(gotoUrl)
    return
  }

  if (success) {
    router.push('/dashboard')
    return
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

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default GithubAuthPage
