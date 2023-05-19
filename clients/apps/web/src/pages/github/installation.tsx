import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { useRouter } from 'next/router'
import { api } from 'polarkit'
import {
  InstallationCreate,
  OrganizationPrivateRead,
} from 'polarkit/api/client'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { NextPageWithLayout } from 'utils/next'

const GithubInstallationPage: NextPageWithLayout = () => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<OrganizationPrivateRead | null>(
    null,
  )
  const query = router.query
  const [showLogin, setShowLogin] = useState(false)

  const install = (query) => {
    const request = api.integrations.install({
      requestBody: {
        platform: InstallationCreate.platform.GITHUB,
        external_id: parseInt(query.installation_id),
      },
    })

    setShowLogin(false)

    request
      .then((organization) => {
        setInstalled(organization)
      })
      .catch((err) => {
        if (err.isCancelled) return
        if (err.status === 401) {
          setShowLogin(true)
          return
        }
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

  const [gotoUrl, setGotoUrl] = useState('')

  useEffect(() => {
    setGotoUrl(window.location.href)
  }, [])

  if (installed) {
    router.replace(`/dashboard/initialize/${installed.name}`)
    return
  }

  if (showLogin) {
    return (
      <LoadingScreen animate={false}>
        <div className="flex flex-col items-center space-y-2">
          <p>Login to continue</p>
          {gotoUrl && <GithubLoginButton gotoUrl={gotoUrl} />}
        </div>
      </LoadingScreen>
    )
  }

  if (error) {
    return (
      <LoadingScreen animate={false}>
        <LoadingScreenError error={error} />
      </LoadingScreen>
    )
  }

  return (
    <LoadingScreen animate={true}>
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
