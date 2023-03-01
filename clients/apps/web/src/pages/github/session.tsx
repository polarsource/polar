import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import { useRouter } from 'next/router'
import Layout from 'components/Layout/GithubCallback'
import { useGithubOAuthCallback } from 'polarkit/hooks'

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
  const { success, error } = useGithubOAuthCallback(query.code, query.state)
  if (success) {
    router.push('/dashboard')
    return
  }

  if (error) return <p>Error: {error}</p>

  return <h1>Authenticating</h1>
}

GithubAuthPage.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default GithubAuthPage
