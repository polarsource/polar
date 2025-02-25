import revalidate from '@/app/actions'
import { useCustomerPaymentMethods } from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { useCallback } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { Well, WellContent, WellFooter, WellHeader } from '../Shared/Well'
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

  const multipleSubscriptions =
    organization.subscription_settings.allow_multiple_subscriptions

  const activeSubscription = subscriptions.find((s) => s.status === 'active')

  const { data: paymentMethods } = useCustomerPaymentMethods(api)

  return (
    <div className="flex flex-col gap-y-8">
      <Well className="flex flex-col gap-y-4">
        <WellHeader>
          <h3 className="text-xl">Payment Method</h3>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            The method used for subscriptions & one-time purchases
          </p>
        </WellHeader>
        <WellContent>
          {paymentMethods?.items.map((pm) => (
            <PaymentMethod paymentMethod={pm} api={api} />
          ))}
        </WellContent>
        <WellFooter>
          <Button className="self-start" onClick={showAddPaymentMethodModal}>
            Add Payment Method
          </Button>
        </WellFooter>
      </Well>
      {multipleSubscriptions ? (
        <MultipleSubscriptionOverview
          api={api}
          organization={organization}
          subscriptions={subscriptions}
          products={products}
        />
      ) : (
        <SingleSubscriptionOverview
          api={api}
          organization={organization}
          subscription={activeSubscription}
          products={products}
        />
      )}
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

interface SingleSubscriptionOverviewProps {
  organization: schemas['Organization']
  subscription?: schemas['CustomerSubscription']
  api: Client
  products: schemas['CustomerProduct'][]
}

const SingleSubscriptionOverview = ({
  subscription,
  api,
  products,
}: SingleSubscriptionOverviewProps) => {
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {subscription ? (
          <CustomerSubscriptionDetails
            api={api}
            subscription={subscription}
            products={products}
            onUserSubscriptionUpdate={onSubscriptionUpdate}
          />
        ) : (
          <div className="dark:bg-polar-800 flex h-full min-h-72 flex-col items-center justify-center gap-4 rounded-2xl bg-gray-100 p-8 text-center">
            <p className="dark:text-polar-500 text-gray-500">
              No active subscription
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface MultipleSubscriptionOverviewProps {
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
}

const MultipleSubscriptionOverview = ({
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </div>
  )
}
