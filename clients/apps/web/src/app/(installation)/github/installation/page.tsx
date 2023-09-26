'use client'

import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from 'polarkit'
import {
  InstallationCreate,
  OrganizationPrivateRead,
} from 'polarkit/api/client'
import { PrimaryButton } from 'polarkit/components/ui'
import { useEffect, useState } from 'react'

export default function Page() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<OrganizationPrivateRead | null>(
    null,
  )

  const search = useSearchParams()

  const installationID = search?.get('installation_id')
  const setupAction = search?.get('setup_action')

  const [showLogin, setShowLogin] = useState(false)

  const redirectToDashboard = () => {
    router.push('/maintainer')
    return
  }

  const install = () => {
    if (!installationID) {
      setError('Unexpected installation_id')
      return
    }

    const request = api.integrations.install({
      requestBody: {
        platform: InstallationCreate.platform.GITHUB,
        external_id: parseInt(installationID),
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
    if (!installationID) {
      return
    }

    const request = install()
    return () => {
      if (request) {
        request.cancel()
      }
    }
  }, [installationID])

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
              text="Continue with GitHub"
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
  if (setupAction === 'request') {
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
