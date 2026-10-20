'use client'

import { formatCredits } from '@/components/Customer/AddCredits/creditPreview'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useHasPermission } from '@/hooks/permissions'
import { useReverseMeterCredit } from '@/hooks/queries/customerMeters'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { useState } from 'react'

export const ReverseCreditButton = ({
  credit,
}: {
  credit: schemas['MeterCreditEvent']
}) => {
  const { show, hide, isShown } = useModal()
  const reverseCredit = useReverseMeterCredit()
  const [reversed, setReversed] = useState(false)
  const canManageCustomers = useHasPermission(
    credit.organization_id,
    'customers:manage',
  )

  const onConfirm = async () => {
    const { data, error } = await reverseCredit.mutateAsync(credit.id)
    if (error) {
      toast({
        title: 'Credits Not Reversed',
        description: extractApiErrorMessage(error),
      })
      return
    }
    setReversed(true)
    const units = Math.abs(data.metadata.units)
    toast({
      title: 'Credits Reversed',
      description:
        units < credit.metadata.units
          ? `Removed ${formatCredits(units)}. The rest had already been used.`
          : `Removed ${formatCredits(units)}. The balance will update shortly.`,
    })
  }

  if (reversed || !canManageCustomers) return null

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        loading={reverseCredit.isPending}
        onClick={show}
      >
        Reverse
      </Button>
      <ConfirmModal
        isShown={isShown}
        hide={hide}
        title={`Reverse ${formatCredits(credit.metadata.units)}?`}
        description="This removes the credits the customer hasn't used yet. Credits already used stay used, and a credit can only be reversed once."
        onConfirm={onConfirm}
        destructive
        destructiveText="Reverse credits"
      />
    </>
  )
}
