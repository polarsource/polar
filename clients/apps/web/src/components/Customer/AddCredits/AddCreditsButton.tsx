'use client'

import { useModal } from '@/components/Modal/useModal'
import { useHasPermission } from '@/hooks/permissions'
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
  const canManageCustomers = useHasPermission(
    organization.id,
    'customers:manage',
  )

  if (!canManageCustomers) return null

  return (
    <>
      <Button onClick={show}>Add credits</Button>
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
