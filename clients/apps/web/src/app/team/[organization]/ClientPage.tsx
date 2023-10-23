'use client'

import Spinner from '@/components/Shared/Spinner'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentOrgAndRepoFromURL()

  if (!isLoaded || !org) {
    return <Spinner />
  }

  return <div>Hello World.</div>
}
