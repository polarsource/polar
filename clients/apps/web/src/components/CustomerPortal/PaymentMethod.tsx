import { useTranslations } from '@/components/CustomerPortal/PortalLocaleProvider'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerPortalCustomer,
  useDeleteCustomerPaymentMethod,
} from '@/hooks/queries/customerPortal'
import type { Client, operations, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Status } from '@polar-sh/ui/components/atoms/Status'
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
  const t = useTranslations()
  const deletePaymentMethod = useDeleteCustomerPaymentMethod(api)
  const { update: updateCustomer } = useCustomerPortalCustomer()
  const isDefault = paymentMethod.id === customer.default_payment_method_id

  const onDeletePaymentMethod = async () => {
    try {
      await deletePaymentMethod.mutateAsync(paymentMethod.id)
      toast({
        title: t('portal.settings.paymentMethod.deletedTitle'),
        description: t('portal.settings.paymentMethod.deletedDescription'),
      })
    } catch (error) {
      toast({
        title: t('portal.settings.paymentMethod.deleteFailedTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('portal.settings.paymentMethod.deleteFailedDescription'),
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
        title: t('portal.settings.paymentMethod.defaultUpdatedTitle'),
        description: t(
          'portal.settings.paymentMethod.defaultUpdatedDescription',
        ),
      })
    } catch (error) {
      toast({
        title: t('portal.settings.paymentMethod.defaultUpdateFailedTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('portal.settings.paymentMethod.defaultUpdateFailedDescription'),
        variant: 'error',
      })
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <PaymentMethodDisplay
        type={paymentMethod.type}
        card={
          isCardPaymentMethod(paymentMethod)
            ? paymentMethod.method_metadata
            : null
        }
      />
      <div className="flex flex-row items-center gap-x-4">
        {isDefault ? (
          <Status
            status={t('portal.settings.paymentMethod.defaultMethod')}
            className="bg-emerald-50 text-emerald-500 dark:bg-emerald-950"
          />
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSetDefaultPaymentMethod}
            loading={updateCustomer.isPending}
            disabled={updateCustomer.isPending}
          >
            {t('portal.settings.paymentMethod.makeDefault')}
          </Button>
        )}
        {deletable && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8"
            onClick={onDeletePaymentMethod}
            loading={deletePaymentMethod.isPending}
            disabled={deletePaymentMethod.isPending}
            aria-label={t('portal.settings.paymentMethod.deleteAriaLabel')}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default PaymentMethod
