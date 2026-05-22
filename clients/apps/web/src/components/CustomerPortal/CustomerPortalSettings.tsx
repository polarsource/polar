'use client'

import revalidate from '@/app/actions'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerPaymentMethods,
  useCustomerPortalCustomer,
} from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'
import { usePaymentMethodRedirectResult } from '@polar-sh/checkout/react/payment-method'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Well, WellContent, WellHeader } from '../Shared/Well'
import ChangeEmailForm from './ChangeEmailForm'
import { CustomerPortalTeamSection } from './CustomerPortalTeam'
import EditBillingDetails from './EditBillingDetails'
import PaymentMethod from './PaymentMethod'

interface CustomerPortalSettingsProps {
  customerSessionToken?: string
  organization: schemas['CustomerOrganization']
}

export const CustomerPortalSettings = ({
  customerSessionToken,
  organization,
}: CustomerPortalSettingsProps) => {
  const api = createClientSideAPI(customerSessionToken)
  const router = useRouter()
  const theme = useTheme()
  const queryClient = useQueryClient()

  const { data: customer } = useCustomerPortalCustomer()
  const { data: paymentMethods } = useCustomerPaymentMethods(api)

  const [isExporting, setIsExporting] = useState(false)

  const onPaymentMethodAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['customer_payment_methods'] })
    revalidate('customer_portal')
    router.refresh()
  }

  usePaymentMethodRedirectResult({
    onSuccess: () => {
      toast({ title: 'Payment method added' })
      onPaymentMethodAdded()
    },
    onError: () =>
      toast({
        title: 'Could not add payment method',
        description: 'Please try again.',
        variant: 'error',
      }),
  })

  const onAddPaymentMethod = async () => {
    if (!customerSessionToken) return
    const embed = await PolarEmbedPaymentMethod.create({
      sessionToken: customerSessionToken,
      theme: theme.resolvedTheme === 'dark' ? 'dark' : 'light',
    })
    embed.addEventListener('success', onPaymentMethodAdded)
  }

  const handleExportData = useCallback(async () => {
    setIsExporting(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/customer-portal/customers/me/export`,
        {
          headers: customerSessionToken
            ? { Authorization: `Bearer ${customerSessionToken}` }
            : {},
          credentials: 'include',
        },
      )
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `polar-customer-export-${customer?.id ?? 'data'}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
    }
  }, [customer, customerSessionToken])

  if (!customer) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-8">
      <h3 className="text-2xl">Billing Settings</h3>
      <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
        <WellHeader className="flex-row items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Payment Methods</h3>
            <p className="dark:text-polar-500 text-gray-500">
              Methods used for subscriptions & one-time purchases
            </p>
          </div>
          <Button onClick={onAddPaymentMethod}>Add Payment Method</Button>
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
            <h3 className="text-xl">Billing Details</h3>
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

      {customer.type !== 'team' &&
        customer.email &&
        organization.customer_portal_settings.customer?.allow_email_change ===
          true && (
          <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
            <WellHeader className="flex-row items-center justify-between">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-xl">Email Address</h3>
                <p className="dark:text-polar-500 text-gray-500">
                  Change the email associated with your account
                </p>
              </div>
            </WellHeader>
            <Separator className="dark:bg-polar-700" />
            <WellContent>
              <ChangeEmailForm customer={customer} />
            </WellContent>
          </Well>
        )}

      {customer.type === 'team' &&
        organization.organization_features?.member_model_enabled && (
          <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
            <WellHeader className="flex-row items-start justify-between">
              <div className="flex flex-col gap-y-2">
                <h3 className="text-xl">Billing Managers</h3>
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

      <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
        <WellHeader className="flex-row items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Privacy</h3>
            <p className="dark:text-polar-500 text-gray-500">
              Download a copy of all your personal data
            </p>
          </div>
          <Button
            onClick={handleExportData}
            loading={isExporting}
            variant="secondary"
          >
            Export Data
          </Button>
        </WellHeader>
      </Well>
    </div>
  )
}
