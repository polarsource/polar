'use client'

import { useModal } from '@/components/Modal/useModal'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal } from '@polar-sh/orbit'
import { AddCreditsModal } from './AddCreditsModal'

export const AddCreditsButton = ({
  organization,
  customer,
  meterId,
}: {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meterId: string
}) => {
  const { show, hide, isShown } = useModal()

  if (!organization.feature_settings?.config_as_code_enabled) return null

  return (
    <>
      <Button variant="secondary" onClick={show}>
        Add credits
      </Button>
      <InlineModal
        isShown={isShown}
        hide={hide}
        modalContent={
          <AddCreditsModal
            organization={organization}
            customer={customer}
            meterId={meterId}
            onClose={hide}
          />
        }
      />
    </>
  )
}
