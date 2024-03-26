'use client'

import Contributors from '@/components/Finance/IssueFunding/Contributors'
import { usePersonalOrganization } from '@/hooks'

export default function ClientPage() {
  const org = usePersonalOrganization()

  if (!org) {
    return null
  }

  return <Contributors organization={org} />
}
