import {
  PaymentStatusDisplayColor,
  PaymentStatusDisplayTitle,
} from '@/utils/payment'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { twMerge } from 'tailwind-merge'

const PaymentStatus = ({
  payment: { status, decline_message },
}: {
  payment: schemas['Payment']
}) => {
  if (status == 'failed') {
    return (
      <Tooltip>
        <TooltipTrigger className="cursor-help">
          <Status
            className={twMerge(
              PaymentStatusDisplayColor[status],
              'w-fit',
              'text-red-500',
            )}
            status={PaymentStatusDisplayTitle[status]}
          />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-64">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <p className="text-justify text-sm">{decline_message}</p>
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Status
      className={twMerge(PaymentStatusDisplayColor[status], 'w-fit')}
      status={PaymentStatusDisplayTitle[status]}
    />
  )
}

export default PaymentStatus
