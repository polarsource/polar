'use client'

import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import GithubLoginButton from '@/components/Shared/GithubLoginButton'
import {
  InstallationCreatePlatformEnum,
  Organization,
  ResponseError,
  UserSignupType,
} from '@polar-sh/sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from 'polarkit'
import { PrimaryButton } from 'polarkit/components/ui/atoms'
import { useEffect, useState } from 'react'

export default function Page() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Organization | null>(null)

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
      console.error('no installation id')
      setError('Unexpected installation_id')
      return
    }

    const controller = new AbortController()
    const signal = controller.signal

    const request = api.integrations.install(
      {
        installationCreate: {
          platform: InstallationCreatePlatformEnum.GITHUB,
          external_id: parseInt(installationID),
        },
      },
      {
        signal,
      },
    )

    setShowLogin(false)
    setError(null)

    request
      .then((organization) => {
        setInstalled(organization)
        // redirect
        router.replace(`/maintainer/${organization.name}/initialize`)
      })
      .catch((err: ResponseError) => {
        if (signal.aborted) {
          return
        }
        if (err.response.status === 401) {
          setShowLogin(true)
          return
        }
        console.error(err)
        setError('Error installing organization')
      })
    return { request, controller }
  }

  useEffect(() => {
    if (!installationID) {
      return
    }

    const i = install()

    return () => {
      if (i) {
        const { controller } = i
        controller.abort()
      }
    }
  }, [installationID])

  const [gotoUrl, setGotoUrl] = useState('')

  useEffect(() => {
    setGotoUrl(window.location.href)
  }, [])

  if (installed) {
    return (
      <LoadingScreen animate={true}>Ready to go! Redirecting...</LoadingScreen>
    )
  }

  if (showLogin) {
    return (
      <LoadingScreen animate={false}>
        <div className="flex flex-col items-center space-y-2">
          <p>Login to continue</p>
          {gotoUrl && (
            <GithubLoginButton
              gotoUrl={gotoUrl}
              userSignupType={UserSignupType.MAINTAINER}
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
