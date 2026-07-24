import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerPortalCustomer,
  useDeleteCustomerPaymentMethod,
} from '@/hooks/queries/customerPortal'
import type { Client, operations, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Status } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { X } from 'lucide-react'
import { PaymentMethodDisplay } from '../PaymentMethodDisplay'

type PaymentMethodType =
  operations['customer_portal:customers:list_payment_methods']['responses']['200']['content']['application/json']['items'][number]

const isCardPaymentMethod = (
  paymentMethod: PaymentMethodType,
): paymentMethod is schemas['PaymentMethodCard'] =>
  paymentMethod.type === 'card'

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
    <Box alignItems="center" justifyContent="between" columnGap="s">
      <PaymentMethodDisplay
        type={paymentMethod.type}
        card={
          isCardPaymentMethod(paymentMethod)
            ? paymentMethod.method_metadata
            : null
        }
      />
      <Box alignItems="center" columnGap="l">
        {isDefault ? (
          <Status status="Default method" color="green" />
        ) : (
          <Button
            variant="secondary"
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
            variant="secondary"
            size="icon"
            onClick={onDeletePaymentMethod}
            loading={deletePaymentMethod.isPending}
            disabled={deletePaymentMethod.isPending}
            aria-label="Delete payment method"
          >
            <X size={16} />
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default PaymentMethod
