'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import SSOSettings from '@/components/Settings/SSO/SSOSettings'
import { schemas } from '@polar-sh/client'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  return (
    <DashboardBody title="Single Sign-On">
      <SSOSettings org={org} />
    </DashboardBody>
  )
}
