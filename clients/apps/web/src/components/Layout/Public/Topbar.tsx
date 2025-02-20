'use client'

import GithubLoginButton from '@/components/Auth/GithubLoginButton'
import { useAuth } from '@/hooks'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandingMenu } from './BrandingMenu'
import TopbarRight from './TopbarRight'

const Topbar = ({
  hideProfile,
  authenticatedUser,
  userOrganizations,
}: {
  hideProfile?: boolean
  authenticatedUser: schemas['UserRead'] | undefined
  userOrganizations: schemas['Organization'][]
}) => {
  // Fallback to client side user loading
  const { currentUser: clientCurrentUser } = useAuth()
  const currentUser = authenticatedUser ?? clientCurrentUser

  const hasOrgs = Boolean(userOrganizations && userOrganizations.length > 0)

  const creatorPath = `/dashboard/${userOrganizations?.[0]?.slug}`

  const githubAccount = currentUser?.oauth_accounts.find(
    (o) => o.platform === 'github',
  )
  const shouldShowGitHubAuthUpsell = !githubAccount

  const pathname = usePathname()
  const returnTo = pathname ?? '/start'

  const upsellOrDashboard = () => {
    if (!currentUser) {
      return null
    }

    return (
      <>
        {shouldShowGitHubAuthUpsell && (
          <GithubLoginButton text="Connect with GitHub" returnTo={returnTo} />
        )}
        {!hasOrgs && (
          <Link href="/dashboard/create">
            <Button type="button" className="space-x-2 p-2 px-4 text-sm">
              <div className="flex flex-row items-center gap-x-2">
                <span className="whitespace-nowrap">Sell with Polar</span>
                <ArrowForwardOutlined fontSize="inherit" />
              </div>
            </Button>
          </Link>
        )}
        {hasOrgs && (
          <Link href={creatorPath}>
            <Button>
              <div className="flex flex-row items-center gap-x-2">
                <span className="whitespace-nowrap text-xs">Dashboard</span>
              </div>
            </Button>
          </Link>
        )}
      </>
    )
  }

  const upsell = upsellOrDashboard()

  return (
    <div className="z-50 flex w-full flex-col items-center py-4">
      <div className="flex w-full max-w-7xl flex-row flex-wrap justify-between gap-y-4 px-2">
        <div className="flex flex-shrink-0 flex-row items-center gap-x-4 md:gap-x-12">
          <BrandingMenu />
        </div>
        {!hideProfile ? (
          <div className="relative flex flex-1 flex-shrink-0 flex-row items-center justify-end gap-x-6 md:ml-0">
            {upsell}
            <TopbarRight authenticatedUser={authenticatedUser} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Topbar
