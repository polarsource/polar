import {
  PaymentStatusDisplayColor,
  PaymentStatusDisplayTitle,
} from '@/utils/payment'
import { schemas } from '@spaire/client'
import { Status } from '@spaire/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@spaire/ui/components/ui/tooltip'
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
