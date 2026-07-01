'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import SSOSettings from '@/components/Settings/SSO/SSOSettings'
import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const canManageSSO = useHasPermission(org.id, 'organization:manage')

  if (canManageSSO === false) {
    return (
      <DashboardBody title="Single Sign-On">
        <AccessRestricted message="You don't have permission to manage single sign-on for this organization. Ask an admin if you need access." />
      </DashboardBody>
    )
  }

  return (
    <DashboardBody title="Single Sign-On">
      <SSOSettings org={org} />
    </DashboardBody>
  )
}
