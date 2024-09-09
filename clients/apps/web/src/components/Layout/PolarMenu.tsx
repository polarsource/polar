'use client'

import PublicProfileDropdown from '@/components/Navigation/PublicProfileDropdown'
import { useLoginLink } from '@/hooks/login'
import { CONFIG } from '@/utils/config'
import { ArrowForwardOutlined } from '@mui/icons-material'
import { Organization, UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import GetStartedButton from '../Auth/GetStartedButton'

const PolarMenu = ({
  authenticatedUser,
  userOrganizations,
  organization,
}: {
  authenticatedUser?: UserRead
  userOrganizations: Organization[]
  organization?: Organization
}) => {
  const loginLink = useLoginLink()

  const hasOrgs = Boolean(userOrganizations && userOrganizations.length > 0)

  const organizationExistsInUserOrgs = userOrganizations.some(
    (userOrg) => userOrg.id === organization?.id
  )

  const creatorPath = `${CONFIG.FRONTEND_BASE_URL}/dashboard/${
    organizationExistsInUserOrgs ? organization?.slug : userOrganizations?.[0]?.slug
  }`

  return (
    <div className="flex h-9 flex-row items-center gap-x-6">
      {authenticatedUser ? (
        <div className="relative flex w-max flex-shrink-0 flex-row items-center justify-between gap-x-6">
          {hasOrgs && (
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
      ) : (
        <>
          <GetStartedButton size="sm" />
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

export default PolarMenu
