'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  if (!isLoaded || !org) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody>
      <div>Hello World.</div>
    </DashboardBody>
  )
}
