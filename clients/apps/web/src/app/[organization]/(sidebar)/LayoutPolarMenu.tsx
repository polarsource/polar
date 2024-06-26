'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { useAuth } from '@/hooks'
import { CONFIG } from '@/utils/config'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Organization, UserRead, UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'

export const PolarMenu = ({
  authenticatedUser,
  userAdminOrganizations,
}: {
  authenticatedUser?: UserRead
  userAdminOrganizations: Organization[]
}) => {
  const pathname = usePathname()
  const loginReturnTo = pathname ?? '/feed'
  const createWithPolarReturnTo = '/me'

  // Fallback to client side user loading (needed as we're loading data in the layout, and it isn't refreshed on navigation)
  const { currentUser: clientCurrentUser } = useAuth()
  const currentUser = authenticatedUser ?? clientCurrentUser

  const personalOrg = userAdminOrganizations?.find((o) => o.is_personal)

  const hasAdminOrgs = Boolean(
    userAdminOrganizations && userAdminOrganizations.length > 0,
  )

  const creatorPath = personalOrg
    ? `${CONFIG.FRONTEND_BASE_URL}/maintainer/${currentUser?.username}/overview`
    : `${CONFIG.FRONTEND_BASE_URL}/maintainer/${userAdminOrganizations?.[0]?.name}/overview`

  const loginLink = `${CONFIG.FRONTEND_BASE_URL}/login?return_to=${loginReturnTo}`

  return (
    <div className="flex flex-row items-center gap-x-6">
      {authenticatedUser ? (
        <div>
          <div className="relative flex w-max flex-shrink-0 flex-row items-center justify-between gap-x-6">
            {hasAdminOrgs && (
              <Link href={creatorPath}>
                <Button>
                  <div className="flex flex-row items-center gap-x-2">
                    <span className="whitespace-nowrap text-xs">
                      Creator Dashboard
                    </span>
                    <ArrowForwardOutlined fontSize="inherit" />
                  </div>
                </Button>
              </Link>
            )}
            <PublicProfileDropdown
              authenticatedUser={authenticatedUser}
              className="flex-shrink-0"
              showAllBackerRoutes
            />
          </div>
        </div>
      ) : (
        <>
          <CreateWithPolar returnTo={createWithPolarReturnTo} />
          <Link
            href={loginLink}
            className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Login
          </Link>
        </>
      )}
    </div>
  )
}

const CreateWithPolar = ({ returnTo }: { returnTo: string }) => {
  return (
    <GithubLoginButton
      text="Create with Polar"
      returnTo={returnTo}
      userSignupType={UserSignupType.MAINTAINER}
    />
  )
}
