'use client'

import revalidate from '@/app/actions'
import { useCustomerPaymentMethods } from '@/hooks/queries'
import { useCustomerPortalCustomer } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { Well, WellContent, WellHeader } from '../Shared/Well'
import { AddPaymentMethodModal } from './AddPaymentMethodModal'
import { CustomerPortalTeamSection } from './CustomerPortalTeam'
import EditBillingDetails from './EditBillingDetails'
import PaymentMethod from './PaymentMethod'

interface CustomerPortalSettingsProps {
  customerSessionToken?: string
  organization: schemas['CustomerOrganization']
  setupIntentParams?: {
    setup_intent_client_secret: string
    setup_intent: string
  }
}

export const CustomerPortalSettings = ({
  customerSessionToken,
  organization,
  setupIntentParams,
}: CustomerPortalSettingsProps) => {
  const api = createClientSideAPI(customerSessionToken)
  const router = useRouter()

  const theme = useTheme()
  const themePreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')

  const {
    isShown: isAddPaymentMethodModalOpen,
    hide: hideAddPaymentMethodModal,
    show: showAddPaymentMethodModal,
  } = useModal(setupIntentParams !== undefined)
  const { data: customer } = useCustomerPortalCustomer()
  const { data: paymentMethods } = useCustomerPaymentMethods(api)

  if (!customer) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-8">
      {/* eslint-disable-next-line no-restricted-syntax */}
      <h3 className="text-2xl">Billing Settings</h3>
      <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
        <WellHeader className="flex-row items-start justify-between">
          <div className="flex flex-col gap-y-2">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <h3 className="text-xl">Payment Methods</h3>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <p className="dark:text-polar-500 text-gray-500">
              Methods used for subscriptions & one-time purchases
            </p>
          </div>
          <Button onClick={showAddPaymentMethodModal}>
            Add Payment Method
          </Button>
        </WellHeader>
        <WellContent className="gap-y-4">
          {paymentMethods?.items.map((pm) => (
            <PaymentMethod
              key={pm.id}
              customer={customer}
              paymentMethod={pm}
              api={api}
              deletable={true}
            />
          ))}
        </WellContent>
      </Well>
      <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
        <WellHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-y-2">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <h3 className="text-xl">Billing Details</h3>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <p className="dark:text-polar-500 text-gray-500">
              Update your billing details
            </p>
          </div>
        </WellHeader>
        <Separator className="dark:bg-polar-700" />
        <WellContent>
          <EditBillingDetails
            onSuccess={() => {
              revalidate(`customer_portal`)
              router.refresh()
            }}
          />
        </WellContent>
      </Well>

      {customer.type === 'team' &&
        organization.organization_features?.member_model_enabled && (
          <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
            <WellHeader className="flex-row items-start justify-between">
              <div className="flex flex-col gap-y-2">
                {/* eslint-disable-next-line no-restricted-syntax */}
                <h3 className="text-xl">Billing Managers</h3>
                {/* eslint-disable-next-line no-restricted-syntax */}
                <p className="dark:text-polar-500 text-gray-500">
                  Billing Managers can manage billing details, payment methods,
                  and subscriptions.
                </p>
              </div>
            </WellHeader>
            <Separator className="dark:bg-polar-700" />
            <WellContent>
              <CustomerPortalTeamSection api={api} />
            </WellContent>
          </Well>
        )}

      <Modal
        title="Add Payment Method"
        isShown={isAddPaymentMethodModalOpen}
        hide={hideAddPaymentMethodModal}
        modalContent={
          <AddPaymentMethodModal
            api={api}
            onPaymentMethodAdded={() => {
              revalidate(`customer_portal`)
              router.refresh()
              hideAddPaymentMethodModal()
            }}
            setupIntentParams={setupIntentParams}
            hide={hideAddPaymentMethodModal}
            themePreset={themePreset}
          />
        }
      />
    </div>
  )
}
