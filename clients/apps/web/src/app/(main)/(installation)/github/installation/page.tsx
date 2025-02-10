'use client'

import revalidate from '@/app/actions'
import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import LoadingScreen, {
  LoadingScreenError,
} from '@/components/Dashboard/LoadingScreen'
import { useAuth } from '@/hooks'
import { useStore } from '@/store'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export default function Page() {
  const search = useSearchParams()
  const installationId = search?.get('installation_id')
  const setupAction = search?.get('setup_action')
  const { gitHubInstallation, clearGitHubInstallation } = useStore()
  const [organizationId, setOrganizationId] = useState<string | undefined>()
  const { userOrganizations: organizations } = useAuth()

  useEffect(() => {
    if (gitHubInstallation.organizationId) {
      setOrganizationId(gitHubInstallation.organizationId)
    }
  }, [gitHubInstallation.organizationId])

  const router = useRouter()
  const pathname = usePathname()
  const [error, setError] = useState<string | null>(null)
  const [installed, setInstalled] = useState<schemas['Organization'] | null>(
    null,
  )

  const [showLogin, setShowLogin] = useState(false)

  const redirectToDashboard = () => {
    router.push('/dashboard')
    return
  }

  const install = useCallback(
    (installationId: string, organizationId: string) => {
      const controller = new AbortController()
      const signal = controller.signal
      const request = api.POST('/v1/integrations/github/installations', {
        body: {
          installation_id: Number.parseInt(installationId, 10),
          organization_id: organizationId,
        },
        signal,
      })

      setShowLogin(false)
      setError(null)

      request
        .then(async ({ data: externalOrganization, error, response }) => {
          if (error) {
            const status = response.status
            if (status === 401) {
              setShowLogin(true)
              return
            } else if (status === 422 && error.detail) {
              setError(error.detail[0].msg)
            }
            return
          }
          const organization = await unwrap(
            api.GET('/v1/organizations/{id}', {
              params: {
                path: { id: externalOrganization.organization_id as string },
              },
            }),
          )
          // As the Organization page & its data is fetched on the server, we need to revalidate the cache
          // to avoid stale data.
          await Promise.all([
            revalidate(`organizations:${organization.id}`),
            revalidate(`organizations:${organization.slug}`),
            revalidate(`storefront:${organization.slug}`),
            revalidate(`funding:${organization.id}`),
            revalidate(`repositories:${organization.id}`),
          ])
          setInstalled(organization)

          clearGitHubInstallation()

          // redirect
          router.replace(`/dashboard/${organization.slug}/initialize`)
        })
        .catch(async () => {
          if (signal.aborted) {
            return
          }
        })

      return { request, controller }
    },
    [router],
  )

  useEffect(() => {
    if (!installationId || !organizationId) {
      return
    }

    const { controller } = install(installationId, organizationId)

    return () => {
      controller.abort()
    }
  }, [installationId, organizationId, install])

  if (!installationId) {
    return (
      <LoadingScreen animate={false}>
        <LoadingScreenError error={'Missing installation_id'} />
      </LoadingScreen>
    )
  }

  if (!organizationId) {
    return (
      <div className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-50">
        <div id="polar-bg-gradient"></div>
        <div className="flex w-80 flex-col items-center gap-6">
          <div className="w-full text-center">
            Select one of your organization to link with this GitHub
            organization:
          </div>
          <div className="flex w-full flex-col gap-2">
            {organizations.map((organization) => (
              <div
                key={organization.id}
                className="hover:bg-polar-600 flex w-full cursor-pointer flex-row items-center gap-2 rounded-md border px-4 py-3 text-sm transition-colors"
                onClick={() => setOrganizationId(organization.id)}
              >
                <Avatar
                  className="h-8 w-8"
                  avatar_url={organization.avatar_url}
                  name={organization.name}
                />
                {organization.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (installed) {
    return (
      <LoadingScreen animate={true}>Ready to go! Redirecting...</LoadingScreen>
    )
  }

  if (showLogin) {
    return (
      <LoadingScreen animate={false}>
        <div className="flex flex-col items-center space-y-2">
          <p>Log in to continue</p>
          {pathname && (
            <GithubLoginButton
              returnTo={pathname}
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
          <Button fullWidth={false} onClick={redirectToDashboard}>
            Go to dashboard
          </Button>
        </div>
      </LoadingScreen>
    )
  }

  return (
    <LoadingScreen animate={true}>
      Connecting your amazing repositories...
    </LoadingScreen>
  )
}
