import {
  PaymentStatusDisplayColor,
  PaymentStatusDisplayTitle,
} from '@/utils/payment'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'

const PaymentStatus = ({
  payment: { status, decline_message },
}: {
  payment: schemas['Payment']
}) => {
  if (status === 'failed') {
    return (
      <Tooltip>
        <TooltipTrigger className="cursor-help">
          <Status
            color={PaymentStatusDisplayColor[status]}
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
      color={PaymentStatusDisplayColor[status]}
      status={PaymentStatusDisplayTitle[status]}
    />
  )
}

export default PaymentStatus
