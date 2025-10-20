'use client'

import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { useLoginLink } from '@/hooks/login'
import { usePostHog } from '@/hooks/posthog'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import GetStartedButton from '../Auth/GetStartedButton'

const PolarMenu = ({
  authenticatedUser,
  userOrganizations,
  organization,
}: {
  authenticatedUser?: schemas['UserRead']
  userOrganizations: schemas['Organization'][]
  organization?: schemas['Organization']
}) => {
  const posthog = usePostHog()
  const loginLink = useLoginLink()

  const hasOrgs = Boolean(userOrganizations && userOrganizations.length > 0)

  const organizationExistsInUserOrgs = userOrganizations.some(
    (userOrg) => userOrg.id === organization?.id,
  )

  const creatorPath = `${CONFIG.FRONTEND_BASE_URL}/dashboard/${
    organizationExistsInUserOrgs
      ? organization?.slug
      : userOrganizations?.[0]?.slug
  }`

  const onLoginClick = () => {
    posthog.capture('global:user:login:click')
  }

  return (
    <div className="flex h-9 flex-row items-center gap-x-6">
      {authenticatedUser ? (
        <div className="relative flex w-max shrink-0 flex-row items-center justify-between gap-x-6">
          {hasOrgs && (
            <Link href={creatorPath}>
              <Button>
                <div className="flex flex-row items-center gap-x-2">
                  <span className="text-xs whitespace-nowrap">Dashboard</span>
                </div>
              </Button>
            </Link>
          )}
          <PublicProfileDropdown
            authenticatedUser={authenticatedUser}
            className="shrink-0"
          />
        </div>
      ) : (
        <>
          <GetStartedButton
            size="sm"
            text="Sell with Polar"
            storefrontOrg={organization}
          />
          <Link
            href={loginLink}
            onClick={onLoginClick}
            className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Log in
          </Link>
        </>
      )}
    </div>
  )
}

export default PolarMenu
