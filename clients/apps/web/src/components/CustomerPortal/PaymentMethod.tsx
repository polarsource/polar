import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerPortalCustomer,
  useDeleteCustomerPaymentMethod,
} from '@/hooks/queries/customerPortal'
import type { Client, operations, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Status } from '@polar-sh/orbit'
import { X } from 'lucide-react'
import {
  PaymentMethodDisplay,
  getPaymentMethodCardInfo,
} from '../PaymentMethodDisplay'
import { PortalListItem } from './PortalPrimitives'

type PaymentMethodType =
  operations['customer_portal:customers:list_payment_methods']['responses']['200']['content']['application/json']['items'][number]

const PaymentMethod = ({
  api,
  customer,
  paymentMethod,
  deletable,
}: {
  api: Client
  customer: schemas['CustomerPortalCustomer']
  paymentMethod: PaymentMethodType
  deletable: boolean
}) => {
  const deletePaymentMethod = useDeleteCustomerPaymentMethod(api)
  const { update: updateCustomer } = useCustomerPortalCustomer()
  const isDefault = paymentMethod.id === customer.default_payment_method_id

  const onDeletePaymentMethod = async () => {
    try {
      await deletePaymentMethod.mutateAsync(paymentMethod.id)
      toast({
        title: 'Payment method deleted',
        description: 'Your payment method has been successfully removed.',
      })
    } catch (error) {
      toast({
        title: 'Failed to delete payment method',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while deleting the payment method.',
        variant: 'error',
      })
    }
  }

  const onSetDefaultPaymentMethod = async () => {
    try {
      await updateCustomer.mutateAsync({
        default_payment_method_id: paymentMethod.id,
      })
      toast({
        title: 'Default payment method updated',
        description: 'This payment method is now your default.',
      })
    } catch (error) {
      toast({
        title: 'Failed to update default payment method',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while updating the default payment method.',
        variant: 'error',
      })
    }
  }

  return (
    <PortalListItem
      title={
        <PaymentMethodDisplay
          type={paymentMethod.type}
          card={getPaymentMethodCardInfo(paymentMethod)}
        />
      }
      meta={isDefault ? <Status size="small" status="Default" /> : undefined}
      actions={
        <>
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetDefaultPaymentMethod}
              loading={updateCustomer.isPending}
              disabled={updateCustomer.isPending}
            >
              Make default
            </Button>
          )}
          {deletable && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove payment method"
              onClick={onDeletePaymentMethod}
              loading={deletePaymentMethod.isPending}
              disabled={deletePaymentMethod.isPending}
            >
              <X className="size-4" />
            </Button>
          )}
        </>
      }
    />
  )
}

export default PaymentMethod
