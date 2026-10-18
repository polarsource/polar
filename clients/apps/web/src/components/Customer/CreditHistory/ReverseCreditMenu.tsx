'use client'

import { formatCredits } from '@/components/Customer/AddCredits/creditPreview'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useReverseMeterCredit } from '@/hooks/queries/customerMeters'
import { extractApiErrorMessage } from '@/utils/api/errors'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useState } from 'react'

export const ReverseCreditMenu = ({
  credit,
}: {
  credit: schemas['MeterCreditEvent']
}) => {
  const { show, hide, isShown } = useModal()
  const reverseCredit = useReverseMeterCredit()
  // The history refetches from the event index, which lags the write.
  const [reversed, setReversed] = useState(false)

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

  if (reversed) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="focus:outline-none" asChild>
          <Button
            className="border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent"
            size="icon"
            variant="secondary"
            aria-label="Credit actions"
          >
            <MoreVertOutlined fontSize="inherit" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="dark:bg-polar-800 bg-gray-50 shadow-lg"
        >
          <DropdownMenuItem destructive onClick={show}>
            Reverse credits
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
