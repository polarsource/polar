import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import Layout from '@/components/Layout/EmptyLayout'
import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { NextPageWithLayout } from '@/utils/next'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { api } from 'polarkit'
import {
  InstallationCreate,
  OrganizationPrivateRead,
} from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import { ParsedUrlQuery } from 'querystring'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'

const GithubInstallationPage: NextPageWithLayout = () => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<OrganizationPrivateRead | null>(
    null,
  )
  const query = router.query
  const [showLogin, setShowLogin] = useState(false)

  const redirectToDashboard = () => {
    router.push('/maintainer')
    return
  }

  const install = (query: ParsedUrlQuery) => {
    if (typeof query?.installation_id !== 'string') {
      setError('Unexpected installation_id')
      return
    }

    const request = api.integrations.install({
      requestBody: {
        platform: InstallationCreate.platform.GITHUB,
        external_id: parseInt(query.installation_id),
      },
    })

    setShowLogin(false)
    setError(null)

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
    router.replace(`/maintainer/${installed.name}/initialize`)
    return <></>
  }

  if (showLogin) {
    return (
      <LoadingScreen animate={false}>
        <div className="flex flex-col items-center space-y-2">
          <p>Login to continue</p>
          {gotoUrl && (
            <GithubLoginButton
              gotoUrl={gotoUrl}
              posthogProps={{
                view: 'Github Installation Page',
              }}
              text="Continue with Github"
            />
          )}
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

  /**
   * In case installation is made by member of an organization vs. admin.
   *
   * Fixed in: https://github.com/polarsource/polar/issues/690
   */
  if (query.setup_action === 'request') {
    return (
      <LoadingScreen animate={false}>
        <div className="text-center">
          <p className="mb-4">
            Thank you! Installation request sent to your organization
            administrators.
          </p>
          <PrimaryButton fullWidth={false} onClick={redirectToDashboard}>
            Go to dashboard
          </PrimaryButton>
        </div>
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const query = context.query

  return { props: { query } }
}

export default GithubInstallationPage
