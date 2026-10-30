'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import NewSSOConnectionModal from '@/components/Settings/SSO/NewSSOConnectionModal'
import { isVerifiedDomain } from '@/components/Settings/SSO/SSODomains'
import SSOSettings from '@/components/Settings/SSO/SSOSettings'
import { useOrganizationDomains } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal } from '@polar-sh/orbit'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const { isShown, show, hide } = useModal()
  const domains = useOrganizationDomains(org.id)
  const hasVerifiedDomain = (domains.data?.items ?? []).some(isVerifiedDomain)

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-md)!"
      title="Single Sign-On"
      header={
        <Button onClick={show} disabled={!hasVerifiedDomain}>
          Add connection
        </Button>
      }
    >
      <SSOSettings org={org} />
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={<NewSSOConnectionModal organization={org} hide={hide} />}
      />
    </DashboardBody>
  )
}
