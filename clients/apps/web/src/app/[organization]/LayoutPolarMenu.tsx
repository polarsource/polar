'use client'

import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { useAuth } from '@/hooks'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Organization, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { getGitHubAuthorizeURL } from 'polarkit/auth'
import { Button } from 'polarkit/components/ui/atoms'

export const PolarMenu = ({
  authenticatedUser,
  userAdminOrganizations,
}: {
  authenticatedUser?: UserRead
  userAdminOrganizations: Organization[]
}) => {
  const pathname = usePathname()
  const returnTo = pathname ?? '/feed'

  // Fallback to client side user loading
  const { currentUser: clientCurrentUser } = useAuth()
  const currentUser = authenticatedUser ?? clientCurrentUser

  const personalOrg = userAdminOrganizations?.find((o) => o.is_personal)

  const hasAdminOrgs = Boolean(
    userAdminOrganizations && userAdminOrganizations.length > 0,
  )

  const creatorPath = personalOrg
    ? `/maintainer/${currentUser?.username}/overview`
    : `/maintainer/${userAdminOrganizations?.[0]?.name}/overview`

  return (
    <div className="flex flex-row items-center gap-x-4">
      {authenticatedUser ? (
        <div>
          <div className="relative flex w-max flex-shrink-0 flex-row items-center justify-between gap-x-6">
            {hasAdminOrgs && (
              <Link href={creatorPath}>
                <Button size="sm">
                  <div className="flex flex-row items-center gap-x-2">
                    <span className="whitespace-nowrap text-xs">
                      Creator Dashboard
                    </span>
                    <ArrowForwardOutlined fontSize="inherit" />
                  </div>
                </Button>
              </Link>
            )}
            <ProfileMenu
              authenticatedUser={authenticatedUser}
              className="flex-shrink-0"
              allBackerRoutes
            />
          </div>
        </div>
      ) : (
        <>
          <CreateWithPolar returnTo={returnTo} />
          <Link
            href={`/login?return_to=${returnTo}`}
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
  const search = useSearchParams()
  const authorizeURL = getGitHubAuthorizeURL({
    paymentIntentId: search?.get('payment_intent_id') ?? undefined,
    returnTo: returnTo,
  })

  return (
    <a href={authorizeURL}>
      <Button variant="secondary" size="sm" asChild>
        Create with Polar
      </Button>
    </a>
  )
}
