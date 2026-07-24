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
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import ChangeEmailForm from './ChangeEmailForm'
import { CustomerPortalTeamSection } from './CustomerPortalTeam'
import EditBillingDetails from './EditBillingDetails'
import PaymentMethod from './PaymentMethod'
import { SettingsPanel } from './SettingsPanel'

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
    <Box flexDirection="column" rowGap="2xl">
      <Text variant="heading-s" as="h3">
        Billing settings
      </Text>

      <SettingsPanel
        title="Payment methods"
        description="Methods used for subscriptions & one-time purchases"
        action={
          <Button onClick={onAddPaymentMethod}>Add payment method</Button>
        }
      >
        {paymentMethods?.items.map((pm) => (
          <PaymentMethod
            key={pm.id}
            customer={customer}
            paymentMethod={pm}
            api={api}
            deletable={true}
          />
        ))}
      </SettingsPanel>

      <SettingsPanel
        title="Billing details"
        description="Update your billing details"
      >
        <EditBillingDetails
          onSuccess={() => {
            revalidate(`customer_portal`)
            router.refresh()
          }}
        />
      </SettingsPanel>

      {customer.type !== 'team' &&
        customer.email &&
        organization.customer_portal_settings.customer?.allow_email_change ===
          true && (
          <SettingsPanel
            title="Email address"
            description="Change the email associated with your account"
          >
            <ChangeEmailForm customer={customer} />
          </SettingsPanel>
        )}

      {customer.type === 'team' &&
        organization.organization_features?.member_model_enabled && (
          <SettingsPanel
            title="Billing managers"
            description="Billing managers can manage billing details, payment methods, and subscriptions."
          >
            <CustomerPortalTeamSection
              api={api}
              organizationSlug={organization.slug}
            />
          </SettingsPanel>
        )}

      <SettingsPanel
        title="Privacy"
        description="Download a copy of all your personal data"
        action={
          <Button
            onClick={handleExportData}
            loading={isExporting}
            variant="secondary"
          >
            Export data
          </Button>
        }
      />
    </Box>
  )
}
