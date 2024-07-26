'use client'

import { useAuth } from '@/hooks'
import { useClientSideLoadedUser } from '@/hooks/docs'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import PolarMenu from '../Layout/PolarMenu'

const UserMenu = () => {
  const { user, loaded } = useClientSideLoadedUser()
  const { userOrganizations: organizations } = useAuth()

  if (!loaded) {
    return (
      <div className="flex h-9 flex-row items-center gap-x-6">
        <div className="relative flex w-max flex-shrink-0 flex-row items-center justify-between gap-x-6">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <PolarMenu authenticatedUser={user} userOrganizations={organizations} />
  )
}

export default UserMenu
