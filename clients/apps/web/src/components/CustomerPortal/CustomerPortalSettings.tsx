'use client'

import revalidate from '@/app/actions'
import {
  useAuthenticatedCustomer,
  useCustomerPaymentMethods,
} from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { Well, WellContent, WellHeader } from '../Shared/Well'
import { AddPaymentMethodModal } from './AddPaymentMethodModal'
import EditBillingDetails from './EditBillingDetails'
import PaymentMethod from './PaymentMethod'

interface CustomerPortalSettingsProps {
  organization: schemas['Organization']
  customerSessionToken?: string
}

export const CustomerPortalSettings = ({
  organization,
  customerSessionToken,
}: CustomerPortalSettingsProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const {
    isShown: isAddPaymentMethodModalOpen,
    hide: hideAddPaymentMethodModal,
    show: showAddPaymentMethodModal,
  } = useModal()
  const { data: customer } = useAuthenticatedCustomer(api)
  const { data: paymentMethods } = useCustomerPaymentMethods(api)

  const theme = useTheme()
  const themingPreset = useThemePreset(
    organization.slug === 'midday' ? 'midday' : 'polar',
    theme.resolvedTheme as 'light' | 'dark',
  )

  if (!customer) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-8">
      <h3 className="text-2xl">Settings</h3>
      <Well
        className={twMerge('flex flex-col gap-y-6', themingPreset.polar.well)}
      >
        <WellHeader className="flex-row items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Payment Methods</h3>
            <p className="dark:text-polar-500 text-gray-500">
              Methods used for subscriptions & one-time purchases
            </p>
          </div>
          <Button
            onClick={showAddPaymentMethodModal}
            className={themingPreset.polar.button}
          >
            Add Payment Method
          </Button>
        </WellHeader>
        <Separator className="dark:bg-polar-700" />
        <WellContent className="gap-y-4">
          {paymentMethods?.items.map((pm) => (
            <PaymentMethod
              key={pm.id}
              customer={customer}
              paymentMethod={pm}
              api={api}
              deletable={paymentMethods.items.length > 1}
            />
          ))}
        </WellContent>
      </Well>
      <Well
        className={twMerge(
          'flex flex-col gap-y-6',
          themingPreset.polar.wellSecondary,
        )}
      >
        <WellHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Billing Details</h3>
            <p className="dark:text-polar-500 text-gray-500">
              Update your billing details
            </p>
          </div>
        </WellHeader>
        <Separator className="dark:bg-polar-700" />
        <WellContent>
          <EditBillingDetails
            api={api}
            customer={customer}
            onSuccess={() => {
              revalidate(`customer_portal`)
            }}
            themingPreset={themingPreset}
          />
        </WellContent>
      </Well>

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
            themingPreset={themingPreset}
          />
        }
      />
    </div>
  )
}
