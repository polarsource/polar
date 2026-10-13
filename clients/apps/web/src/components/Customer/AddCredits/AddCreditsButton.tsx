'use client'

import { useModal } from '@/components/Modal/useModal'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal } from '@polar-sh/orbit'
import { AddCreditsModal } from './AddCreditsModal'
import { useCanAddCredits } from './useCanAddCredits'

interface AddCreditsProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meterId?: string
}

export const useAddCreditsModal = ({
  organization,
  customer,
  meterId,
}: AddCreditsProps) => {
  const canAddCredits = useCanAddCredits(organization)
  const { show, hide, isShown } = useModal()

  const modal = canAddCredits ? (
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
  ) : null

  return { canAddCredits, show, modal }
}

export const AddCreditsButton = (props: AddCreditsProps) => {
  const { canAddCredits, show, modal } = useAddCreditsModal(props)

  if (!canAddCredits) return null

  return (
    <>
      <Button variant="secondary" onClick={show}>
        Add credits
      </Button>
      {modal}
    </>
  )
}
