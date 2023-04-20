import Layout from 'components/Layout/EmptyLayout'
import { api } from 'polarkit'
import { ReactElement, useEffect, useState } from 'react'
import type { NextPageWithLayout } from 'utils/next'

const ExtensionSettingsPage: NextPageWithLayout = () => {
  const [token, setToken] = useState<string>()

  useEffect(() => {
    ;(async () => {
      const response = await api.users.createToken()
      if (response.token) {
        setToken(response.token)
      }
    })()
  }, [])

  return (
    <>
      <h1>Congrats on getting the extension</h1>
      <div id="polar-token">{token}</div>
    </>
  )
}

ExtensionSettingsPage.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default ExtensionSettingsPage
