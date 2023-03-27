import EmptyLayout from 'components/Layout/EmptyLayout'
import { useRouter } from 'next/router'
import { api } from 'polarkit'
import { InstallationCreate, OrganizationRead } from 'polarkit/api/client'
import { useAuth } from 'polarkit/hooks'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { NextPageWithLayout } from 'utils/next'

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

  if (error) return <p>Error: {error}</p>

  if (installed) {
    router.replace(`/dashboard/initialize/${installed.name}`)
    return
  }
  return <h1>Installing...</h1>
}

GithubInstallationPage.getLayout = (page: ReactElement) => {
  return <EmptyLayout>{page}</EmptyLayout>
}

export const getServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default GithubInstallationPage
