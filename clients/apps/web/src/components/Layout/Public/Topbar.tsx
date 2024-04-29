'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { useAuth } from '@/hooks'
import { ArrowForwardOutlined } from '@mui/icons-material'
import {
  Organization,
  Platforms,
  UserRead,
  UserSignupType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useCallback } from 'react'

import {
  unauthenticatedRoutes,
  useBackerRoutes,
} from '@/components/Dashboard/navigation'
import { useMaintainerUpgrade } from '@/hooks/queries'
import { BrandingMenu } from './BrandingMenu'
import TopbarNavigation from './TopbarNavigation'
import TopbarRight from './TopbarRight'

const Topbar = ({
  hideProfile,
  authenticatedUser,
  userAdminOrganizations,
}: {
  hideProfile?: boolean
  authenticatedUser: UserRead | undefined
  userAdminOrganizations: Organization[]
}) => {
  // Fallback to client side user loading
  const { currentUser: clientCurrentUser } = useAuth()
  const currentUser = authenticatedUser ?? clientCurrentUser

  const personalOrg = userAdminOrganizations?.find((o) => o.is_personal)

  const router = useRouter()

  const hasAdminOrgs = Boolean(
    userAdminOrganizations && userAdminOrganizations.length > 0,
  )

  const creatorPath = personalOrg
    ? `/maintainer/${currentUser?.username}/overview`
    : `/maintainer/${userAdminOrganizations?.[0]?.name}/overview`

  const maintainerUpgrade = useMaintainerUpgrade()

  const upgradeToMaintainer = useCallback(async () => {
    await maintainerUpgrade.mutateAsync()
    router.push(`/maintainer/${currentUser?.username}/overview`)
  }, [currentUser, maintainerUpgrade, router])

  const githubAccount = currentUser?.oauth_accounts.find(
    (o) => o.platform === Platforms.GITHUB,
  )
  const shouldShowGitHubAuthUpsell = !githubAccount

  const pathname = usePathname()
  const returnTo = pathname ?? '/feed'

  const upsellOrDashboard = () => {
    if (!currentUser) {
      return null
    }

    if (shouldShowGitHubAuthUpsell) {
      return (
        <GithubLoginButton
          className="border-none bg-blue-500 text-white hover:bg-blue-400 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:hover:text-white"
          text="Connect with GitHub"
          returnTo={returnTo}
          userSignupType={UserSignupType.BACKER}
        />
      )
    }

    if (hasAdminOrgs) {
      return (
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
      )
    }

    return (
      <Button
        onClick={upgradeToMaintainer}
        loading={maintainerUpgrade.isPending}
      >
        <div className="flex flex-row items-center gap-x-2">
          <span className="whitespace-nowrap text-xs">Become a Creator</span>
          <ArrowForwardOutlined fontSize="inherit" />
        </div>
      </Button>
    )
  }

  const upsell = upsellOrDashboard()

  const backerRoutes = useBackerRoutes()

  const routes = authenticatedUser ? backerRoutes : unauthenticatedRoutes

  return (
    <div className=" dark:bg-polar-800 sticky top-0 z-50 flex w-full  flex-col items-center bg-white py-4">
      <div className="flex w-full max-w-7xl flex-row flex-wrap justify-between gap-y-4 px-2">
        <div className="flex flex-shrink-0 flex-row items-center gap-x-4 md:gap-x-12">
          <BrandingMenu />

          <div className="flex flex-shrink-0 flex-row items-center gap-4">
            <TopbarNavigation
              routes={routes}
              unauthenticated={!authenticatedUser}
            />
          </div>
        </div>
        {!hideProfile ? (
          <div className="relative flex flex-1 flex-shrink-0 flex-row items-center justify-end gap-x-6 md:ml-0 ">
            {upsell}
            <TopbarRight authenticatedUser={authenticatedUser} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Topbar
