'use client'

import { PolarMenu } from '@/app/[organization]/(sidebar)/LayoutPolarMenu'
import { useListAdminOrganizations } from '@/hooks/queries'
import { api } from '@/utils/api'
import { UserRead } from '@polar-sh/sdk'
import { Skeleton } from 'polarkit/components/ui/skeleton'
import { useCallback, useEffect, useState } from 'react'

const UserMenu = () => {
  const [loaded, setLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserRead | undefined>()
  const { data: organizations, refetch } = useListAdminOrganizations(false)

  const reload = useCallback(async (): Promise<undefined> => {
    try {
      const user = await api.users.getAuthenticated()
      setCurrentUser(user)
      await refetch()
    } catch {
    } finally {
      setLoaded(true)
    }
  }, [refetch])

  useEffect(() => {
    reload()
  }, [reload])

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
    <PolarMenu
      authenticatedUser={currentUser}
      userAdminOrganizations={organizations?.items ?? []}
    />
  )
}

export default UserMenu
