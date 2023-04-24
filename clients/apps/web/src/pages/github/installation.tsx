import LoadingScreen from 'components/Dashboard/LoadingScreen'
import Layout from 'components/Layout/EmptyLayout'
import { useRouter } from 'next/router'
import { api } from 'polarkit'
import { InstallationCreate, OrganizationRead } from 'polarkit/api/client'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { NextPageWithLayout } from 'utils/next'
import { useAuth } from '../../hooks'

const GithubInstallationPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { authenticated } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<OrganizationRead | null>(null)
  const query = router.query

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

  if (installed) {
    router.replace(`/dashboard/initialize/${installed.name}`)
    return
  }

  return (
    <LoadingScreen error={error}>
      Connecting your amazing repositories.
    </LoadingScreen>
  )
}

GithubInstallationPage.getLayout = (page: ReactElement) => {
  return <Layout>{page}</Layout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default GithubInstallationPage
