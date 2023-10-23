'use client'

import Spinner from '@/components/Shared/Spinner'
import { useCurrentTeamFromURL } from '@/hooks/org'

export default function ClientPage() {
  const { org, isLoaded } = useCurrentTeamFromURL()

  if (!isLoaded || !org) {
    return <Spinner />
  }

  return <div>Hello World.</div>
}
