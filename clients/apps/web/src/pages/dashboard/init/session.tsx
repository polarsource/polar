import type { ReactElement } from 'react'
import type { NextPageWithLayout } from 'utils/next'
import { useRouter } from 'next/router'
import { useOAuthExchange } from 'polarkit/hooks'
import InitLayout from 'components/Dashboard/InitLayout'

const InitSessionPage: NextPageWithLayout = ({
  query,
}: {
  query: {
    provider: string
    code: string
    state: string
  }
}) => {
  const router = useRouter()
  const { session, error } = useOAuthExchange(query.code, query.state)
  if (session?.authenticated) {
    return router.push('/dashboard')
  }

  return <h1>Authenticating</h1>
}

InitSessionPage.getLayout = (page: ReactElement) => {
  return <InitLayout>{page}</InitLayout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default InitSessionPage
