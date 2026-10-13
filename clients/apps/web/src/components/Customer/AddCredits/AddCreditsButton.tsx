'use client'

import { useModal } from '@/components/Modal/useModal'
import { schemas } from '@polar-sh/client'
import { Button, DataTableColumnDef, InlineModal } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
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
  const [selectedMeterId, setSelectedMeterId] = useState(meterId)

  const showForMeter = (id: string) => {
    setSelectedMeterId(id)
    show()
  }

  const modal = canAddCredits ? (
    <InlineModal
      isShown={isShown}
      hide={hide}
      modalContent={
        <AddCreditsModal
          organization={organization}
          customer={customer}
          meterId={selectedMeterId}
          onClose={hide}
        />
      }
    />
  ) : null

  return { canAddCredits, show, showForMeter, modal }
}

export const addCreditsColumn = <T extends { meter_id: string }>(
  onAddCredits: (meterId: string) => void,
): DataTableColumnDef<T> => ({
  id: 'add_credits',
  header: '',
  size: 130,
  cell: ({ row }) => (
    <Box justifyContent="end">
      <Button
        variant="secondary"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onAddCredits(row.original.meter_id)
        }}
      >
        Add credits
      </Button>
    </Box>
  ),
})

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
