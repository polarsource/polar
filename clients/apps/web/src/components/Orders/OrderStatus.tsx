import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'

const OrderStatusDisplayTitle: Record<schemas['Order']['status'], string> = {
  draft: 'Draft',
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
  void: 'Void',
}

const OrderStatusDisplayColor: Record<schemas['Order']['status'], StatusColor> =
  {
    draft: 'gray',
    paid: 'green',
    pending: 'yellow',
    refunded: 'purple',
    partially_refunded: 'purple',
    void: 'red',
  }

export const OrderStatus = ({
  status,
  size,
}: {
  status: schemas['Order']['status']
  size?: 'small' | 'medium'
}) => {
  return (
    <Status
      color={OrderStatusDisplayColor[status]}
      status={OrderStatusDisplayTitle[status]}
      size={size}
    />
  )
}
