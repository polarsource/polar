import type { ReactElement } from 'react'
import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { api } from 'polarkit'
import { useAuth } from 'polarkit/hooks'
import { useSSE } from 'polarkit/hooks'
import { InstallationCreate } from 'polarkit/api/client'
import Layout from 'components/Layout/GithubCallback'

const isInstallationCallback = (query) => {
  return query.installation_id !== undefined
}

const SyncRepo = () => {
  return <h1>Syncing repo</h1>
}

const GithubInstallationPage: NextPage = ({ query }) => {
  const { authenticated } = useAuth()
  const [installed, setInstalled] = useState(false)

  const install = (query) => {
    const request = api.integrations.install({
      requestBody: {
        platform: InstallationCreate.platform.GITHUB,
        external_id: parseInt(query.installation_id),
      },
    })

    request
      .then((res) => {
        setInstalled(true)
      })
      .catch((err) => {
        setInstalled(true)
      })
    return request
  }

  useEffect(() => {
    if (!isInstallationCallback(query)) {
      return
    }

    const request = install(query)

    return () => {
      if (request) {
        request.cancel()
      }
    }
  }, [])

  if (installed) {
    return <SyncRepo />
  }
  return <h1>Installing...</h1>
}

GithubInstallationPage.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default GithubInstallationPage
