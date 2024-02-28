'use client'

import { ProfileMenu } from '@/components/Shared/ProfileSelection'
import { UserRead } from '@polar-sh/sdk'
import { usePathname, useSearchParams } from 'next/navigation'
import { getGitHubAuthorizeURL } from 'polarkit/auth'
import { LogoIcon } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'

export const PolarMenu = ({
  authenticatedUser,
}: {
  authenticatedUser?: UserRead
}) => {
  const pathname = usePathname()
  const returnTo = pathname ?? '/feed'

  return (
    <div className="flex flex-row items-center gap-x-4">
      {authenticatedUser ? (
        <div>
          <div className="relative flex w-max flex-shrink-0 flex-row items-center justify-between gap-x-6">
            <ProfileMenu
              authenticatedUser={authenticatedUser}
              className="flex-shrink-0"
            />
          </div>
        </div>
      ) : (
        <>
          <CreateWithPolar returnTo={returnTo} />
          <a href="/">
            <LogoIcon className="text-blue-500 dark:text-blue-400" size={40} />
          </a>
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
      <Button variant="secondary" asChild>
        Create with Polar
      </Button>
    </a>
  )
}
