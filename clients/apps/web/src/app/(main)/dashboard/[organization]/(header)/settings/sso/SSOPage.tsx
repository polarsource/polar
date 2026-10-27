'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import NewSSOConnectionModal from '@/components/Settings/SSO/NewSSOConnectionModal'
import SSOSettings from '@/components/Settings/SSO/SSOSettings'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal } from '@polar-sh/orbit'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const { isShown, show, hide } = useModal()

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-md)!"
      title="Single Sign-On"
      header={<Button onClick={show}>Add connection</Button>}
    >
      <SSOSettings org={org} onAddConnection={show} />
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={<NewSSOConnectionModal organization={org} hide={hide} />}
      />
    </DashboardBody>
  )
}
