import revalidate from '@/app/actions'
import { useCustomerPaymentMethods } from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { useCallback } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { Well, WellContent, WellHeader } from '../Shared/Well'
import CustomerSubscriptionDetails from '../Subscriptions/CustomerSubscriptionDetails'
import { AddPaymentMethodModal } from './AddPaymentMethodModal'
import PaymentMethod from './PaymentMethod'

interface CustomerPortalOverviewProps {
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
}

export const CustomerPortalOverview = ({
  organization,
  subscriptions,
  products,
  api,
}: CustomerPortalOverviewProps) => {
  const {
    isShown: isAddPaymentMethodModalOpen,
    hide: hideAddPaymentMethodModal,
    show: showAddPaymentMethodModal,
  } = useModal()

  const { data: paymentMethods } = useCustomerPaymentMethods(api)

  return (
    <div className="flex flex-col gap-y-8">
      <Well className="flex flex-col gap-y-6">
        <WellHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Payment Methods</h3>
            <p className="dark:text-polar-500 text-gray-500">
              Methods used for subscriptions & one-time purchases
            </p>
          </div>
          <Button onClick={showAddPaymentMethodModal}>
            Add Payment Method
          </Button>
        </WellHeader>
        <Separator className="dark:bg-polar-700" />
        <WellContent className="gap-y-4">
          {paymentMethods?.items.map((pm) => (
            <PaymentMethod key={pm.id} paymentMethod={pm} api={api} />
          ))}
        </WellContent>
      </Well>
      <SubscriptionsOverview
        api={api}
        organization={organization}
        subscriptions={subscriptions}
        products={products}
      />
      <Modal
        isShown={isAddPaymentMethodModalOpen}
        hide={hideAddPaymentMethodModal}
        modalContent={
          <AddPaymentMethodModal
            api={api}
            onPaymentMethodAdded={() => {
              revalidate(`customer_portal`)
              hideAddPaymentMethodModal()
            }}
            hide={hideAddPaymentMethodModal}
          />
        }
      />
    </div>
  )
}

interface MultipleSubscriptionOverviewProps {
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
}

const SubscriptionsOverview = ({
  organization,
  subscriptions,
  products,
  api,
}: MultipleSubscriptionOverviewProps) => {
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <div className="flex flex-col gap-y-4">
      {subscriptions.map((s) => (
        <CustomerSubscriptionDetails
          key={s.id}
          api={api}
          subscription={s}
          products={products}
          onUserSubscriptionUpdate={onSubscriptionUpdate}
        />
      ))}
    </div>
  )
}
