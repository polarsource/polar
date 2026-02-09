import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { useCustomerSSE } from '@/hooks/sse'
import { createClientSideAPI } from '@/utils/client'
import type { ProductCheckoutPublic } from '@polar-sh/checkout/guards'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { useEffect } from 'react'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { SpinnerNoMargin } from '../Shared/Spinner'

interface CheckoutBenefitsProps {
  checkout: ProductCheckoutPublic
  locale?: AcceptedLocale
  customerSessionToken?: string
  maxWaitingTimeMs?: number
}

const CheckoutBenefits = ({
  checkout,
  locale,
  customerSessionToken,
  maxWaitingTimeMs = 15000,
}: CheckoutBenefitsProps) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)
  const api = createClientSideAPI(customerSessionToken)
  const { data: benefitGrants, refetch } = useCustomerBenefitGrants(api, {
    checkout_id: checkout.id,
  })
  const expectedBenefits = checkout.product.benefits.length

  const customerEvents = useCustomerSSE(customerSessionToken)
  useEffect(() => {
    customerEvents.on('benefit.granted', refetch)
    return () => {
      customerEvents.off('benefit.granted', refetch)
    }
  }, [customerEvents, refetch])

  useEffect(() => {
    if (benefitGrants && benefitGrants.items.length >= expectedBenefits) {
      return
    }
    const intervalId = setInterval(() => {
      refetch()
    }, maxWaitingTimeMs)
    return () => clearInterval(intervalId)
  }, [benefitGrants, expectedBenefits, maxWaitingTimeMs, refetch])

  return (
    <>
      <div className="flex w-full flex-col gap-4 text-left">
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
          {benefitGrants && benefitGrants.items.length < expectedBenefits && (
            <ListItem className="flex flex-row items-center justify-center gap-2">
              <SpinnerNoMargin className="h-4 w-4" />
              <p className="dark:text-polar-500 text-gray-500">
                {t('checkout.benefits.granting')}
              </p>
            </ListItem>
          )}
        </List>
      </div>
    </>
  )
}

export default CheckoutBenefits
