import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import type { NextPageWithLayout } from '@/utils/next'
import { GetServerSideProps } from 'next'
import { api } from 'polarkit'
import { ReactElement, useEffect, useState } from 'react'

const ExtensionSettingsPage: NextPageWithLayout = () => {
  const [token, setToken] = useState<string>()

  useEffect(() => {
    api.users.createToken().then((response) => {
      if (response.token) {
        setToken(response.token)
      }
    })
  }, [])

  return (
    <>
      <div id="polar-token" style={{ color: 'white' }}>
        {token}
      </div>

      <LoadingScreen>
        <>One second, creating a connection...</>
      </LoadingScreen>
    </>
  )
}

ExtensionSettingsPage.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default ExtensionSettingsPage
