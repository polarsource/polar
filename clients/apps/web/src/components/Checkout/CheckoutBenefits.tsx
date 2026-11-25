import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { useCustomerSSE } from '@/hooks/sse'
import { createClientSideAPI } from '@/utils/client'
import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import { UnauthorizedResponseError } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { List, ListItem } from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { SpinnerNoMargin } from '@polar-sh/orbit'

interface CheckoutBenefitsProps {
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
  customerSessionToken?: string
  maxWaitingTimeMs?: number
}

const CheckoutBenefits = ({
  checkout,
  locale = DEFAULT_LOCALE,
  customerSessionToken,
  maxWaitingTimeMs = 15000,
}: CheckoutBenefitsProps) => {
  const t = useTranslations(locale)
  const router = useRouter()
  const api = createClientSideAPI(customerSessionToken)
  const expectedBenefits = checkout.product.benefits.length
  const {
    data: benefitGrants,
    error,
    refetch,
  } = useCustomerBenefitGrants(
    api,
    { checkout_id: checkout.id },
    {
      refetchInterval: (data) =>
        data && data.items.length >= expectedBenefits
          ? false
          : maxWaitingTimeMs,
    },
  )

  const sessionExpired = error instanceof UnauthorizedResponseError
  useEffect(() => {
    if (!sessionExpired) {
      return
    }
    const searchParams = new URLSearchParams()
    if (checkout.customer_email) {
      searchParams.set('email', checkout.customer_email)
    }
    router.replace(
      `/${checkout.organization.slug}/portal/request?${searchParams}`,
    )
  }, [
    sessionExpired,
    router,
    checkout.organization.slug,
    checkout.customer_email,
  ])

  const customerEvents = useCustomerSSE(customerSessionToken)
  useEffect(() => {
    customerEvents.on('benefit.granted', refetch)
    return () => {
      customerEvents.off('benefit.granted', refetch)
    }
  }, [customerEvents, refetch])

  if (expectedBenefits === 0) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-4 text-start">
      <List className="rounded-3xl">
        {benefitGrants?.items.map((benefitGrant) => (
          <ListItem
            key={benefitGrant.id}
            className="dark:bg-polar-800 dark:hover:bg-polar-800 bg-white p-4 hover:bg-white"
          >
            <BenefitGrant
              api={api}
              benefitGrant={benefitGrant}
              locale={locale}
            />
          </ListItem>
        ))}
        {(benefitGrants?.items?.length || 0) < expectedBenefits && (
          <ListItem className="flex flex-row items-center justify-center gap-2">
            <SpinnerNoMargin className="h-4 w-4" />
            <p className="dark:text-polar-500 text-gray-500">
              {t('checkout.benefits.granting')}
            </p>
          </ListItem>
        )}
      </List>
    </div>
  )
}

export default CheckoutBenefits
