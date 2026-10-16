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
import { Button } from '@polar-sh/orbit'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import ChangeEmailForm from './ChangeEmailForm'
import { CustomerPortalTeamSection } from './CustomerPortalTeam'
import EditBillingDetails from './EditBillingDetails'
import PaymentMethod from './PaymentMethod'
import {
  PortalCardList,
  PortalEmptyState,
  PortalPageHeader,
  PortalSection,
} from './PortalPrimitives'

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

  const hasPaymentMethods = (paymentMethods?.items.length ?? 0) > 0

  return (
    <>
      <PortalPageHeader
        title="Billing"
        description="Payment methods, billing details and account settings"
      />

      <PortalSection
        title="Payment methods"
        description="Used for subscriptions and one-time purchases"
        actions={
          <Button variant="secondary" size="sm" onClick={onAddPaymentMethod}>
            Add payment method
          </Button>
        }
      >
        {hasPaymentMethods ? (
          <PortalCardList>
            {paymentMethods?.items.map((pm) => (
              <PaymentMethod
                key={pm.id}
                customer={customer}
                paymentMethod={pm}
                api={api}
                deletable={true}
              />
            ))}
          </PortalCardList>
        ) : (
          <PortalEmptyState
            title="No payment methods"
            description="Add a payment method to use it for future charges."
          />
        )}
      </PortalSection>

      <PortalSection
        title="Billing details"
        description="Shown on your invoices and receipts"
      >
        <EditBillingDetails
          onSuccess={() => {
            revalidate(`customer_portal`)
            router.refresh()
          }}
        />
      </PortalSection>

      {customer.type !== 'team' &&
        customer.email &&
        organization.customer_portal_settings.customer?.allow_email_change ===
          true && (
          <PortalSection
            title="Email address"
            description="The email you use to sign in to this portal"
          >
            <ChangeEmailForm customer={customer} />
          </PortalSection>
        )}

      {customer.type === 'team' && (
        <PortalSection
          title="Billing managers"
          description="Billing managers can manage billing details, payment methods and subscriptions."
        >
          <CustomerPortalTeamSection
            api={api}
            organizationSlug={organization.slug}
          />
        </PortalSection>
      )}

      <PortalSection
        title="Privacy"
        description="Download a copy of all your personal data"
        actions={
          <Button
            onClick={handleExportData}
            loading={isExporting}
            variant="secondary"
            size="sm"
          >
            Export data
          </Button>
        }
      />
    </>
  )
}
