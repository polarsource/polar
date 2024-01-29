'use client'

import { useAuth, useGitHubAccount, usePersonalOrganization } from '@/hooks'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { UserRead, UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { LogoIcon } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useCallback } from 'react'
import BackerNavigation from '../Dashboard/BackerNavigation'
import GithubLoginButton from './GithubLoginButton'
import TopbarRight from './TopbarRight'

const Topbar = ({
  hideProfile,
  authenticatedUser,
}: {
  hideProfile?: boolean
  authenticatedUser?: UserRead
}) => {
  const { currentUser, authenticated } = useAuth()
  const adminOrgs = useListAdminOrganizations()
  const personalOrg = usePersonalOrganization()
  const router = useRouter()

  const hasAdminOrgs = (adminOrgs.data?.items?.length ?? 0) > 0
  const adminOrgsLoaded = !adminOrgs.isPending
  const hasPersonalOrg = !!personalOrg
  const shouldRenderCreateButton = authenticated && hasAdminOrgs
  const creatorPath = hasPersonalOrg
    ? `/maintainer/${currentUser?.username}/overview`
    : `/maintainer/${adminOrgs.data?.items?.[0]?.name}/overview`

  const upgradeToMaintainer = useCallback(async () => {
    const response = await api.users.maintainerUpgrade()
    router.push(`/maintainer/${currentUser?.username}/overview`)
  }, [currentUser])

  const githubAccount = useGitHubAccount()
  const shouldShowGitHubAuthUpsell = !githubAccount

  const creatorCTA = adminOrgsLoaded ? (
    shouldRenderCreateButton ? (
      <Link href={creatorPath}>
        <Button>
          <div className="flex flex-row items-center gap-x-2">
            <span className="text-xs">Creator Dashboard</span>
            <ArrowForwardOutlined fontSize="inherit" />
          </div>
        </Button>
      </Link>
    ) : (
      <Button onClick={upgradeToMaintainer}>
        <div className="flex flex-row items-center gap-x-2">
          <span className="text-xs">Become a Creator</span>
          <ArrowForwardOutlined fontSize="inherit" />
        </div>
      </Button>
    )
  ) : null

  return (
    <div className="dark:border-b-polar-800 dark:bg-polar-950 sticky top-0 z-50 flex w-full flex-col items-center justify-start border-b border-b-gray-100 bg-white py-4">
      <div className="flex w-full max-w-7xl flex-col items-stretch justify-between gap-y-4 px-2 md:flex-row md:items-center">
        <div className="flex flex-row items-center gap-x-4 md:gap-x-16">
          <Link href="/">
            <LogoIcon className="text-blue-500 dark:text-blue-400" size={42} />
          </Link>
          <div className="flex flex-row items-center gap-4">
            <BackerNavigation />
          </div>
        </div>
        <div className="flex flex-row items-center justify-between gap-x-4">
          {authenticated &&
            (shouldShowGitHubAuthUpsell ? (
              <GithubLoginButton
                className="border-none bg-blue-500 text-white hover:bg-blue-400 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:hover:text-white"
                text="Connect with GitHub"
                returnTo={'/feed'}
                userSignupType={UserSignupType.BACKER}
              />
            ) : (
              creatorCTA
            ))}
          <TopbarRight authenticatedUser={currentUser} />
        </div>
      </div>
    </div>
  )
}
export default Topbar
