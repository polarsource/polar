import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import LoadingScreen from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import type { NextPageWithLayout } from '@/utils/next'
import { useRouter } from 'next/router'
import { api } from 'polarkit'
import { ReactElement, useEffect, useState } from 'react'

const ExtensionSettingsPage: NextPageWithLayout = () => {
  const [token, setToken] = useState<string>()
  const router = useRouter()

  useEffect(() => {
    api.users
      .createToken()
      .then((response) => {
        if (response.token) {
          setToken(response.token)
        }
      })
      .catch((error) => {
        if (error.status === 401) {
          router.push('/?goto_url=/settings/extension')
        }
      })
  }, [router])

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
  return (
    <Gatekeeper>
      <Layout>{page}</Layout>
    </Gatekeeper>
  )
}

export default ExtensionSettingsPage
