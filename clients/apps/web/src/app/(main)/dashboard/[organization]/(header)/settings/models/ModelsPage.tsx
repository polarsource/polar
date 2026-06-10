'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ModelSettings from '@/components/Settings/Models/ModelSettings'
import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'

export default function ModelsPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const canManage = useHasPermission(org.id, 'organization:manage')

  if (canManage === false) {
    return (
      <DashboardBody title="Models">
        <AccessRestricted message="You don't have permission to manage models for this organization. Ask an admin if you need access." />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody title="Models">
      <ModelSettings org={org} />
    </DashboardBody>
  )
}
