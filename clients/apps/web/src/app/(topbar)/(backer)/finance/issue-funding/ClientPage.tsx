'use client'

import Current from '@/components/Finance/IssueFunding/Current'
import { usePersonalOrganization } from '@/hooks'

export default function ClientPage() {
  const org = usePersonalOrganization()

  if (!org) {
    return null
  }

  return <Current organization={org} />
}
