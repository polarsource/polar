import type { ReactElement } from 'react'
import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { api } from 'polarkit'
import { useAuth } from 'polarkit/hooks'
import { useRouter } from 'next/router'
import { InstallationCreate, OrganizationSchema } from 'polarkit/api/client'
import Layout from 'components/Layout/GithubCallback'

const GithubInstallationPage: NextPage = ({ query }) => {
  const router = useRouter()
  const { authenticated } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<OrganizationSchema | null>(null)

  const install = (query) => {
    const request = api.integrations.install({
      requestBody: {
        platform: InstallationCreate.platform.GITHUB,
        external_id: parseInt(query.installation_id),
      },
    })

    request
      .then((organization) => {
        setInstalled(organization)
      })
      .catch((err) => {
        if (err.isCancelled) return
        setError('Error installing organization')
      })
    return request
  }

  useEffect(() => {
    if (!query.installation_id) {
      return
    }

    const request = install(query)
    return () => {
      if (request) {
        request.cancel()
      }
    }
  }, [query])

  if (error) return <p>Error: {error}</p>

  if (installed) {
    router.replace(`/dashboard/initialize/${installed.name}`)
    return
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
