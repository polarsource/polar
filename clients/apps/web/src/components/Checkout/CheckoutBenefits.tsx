import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { useCustomerSSE } from '@/hooks/sse'
import { buildAPI } from '@/utils/api'
import { CheckoutPublic } from '@polar-sh/sdk'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { useEffect } from 'react'
import { BenefitGrant } from '../Benefit/BenefitGrant'
import { SpinnerNoMargin } from '../Shared/Spinner'

interface CheckoutBenefitsProps {
  checkout: CheckoutPublic
  customerSessionToken?: string
}

const CheckoutBenefits = ({
  checkout,
  customerSessionToken,
}: CheckoutBenefitsProps) => {
  const api = buildAPI({ token: customerSessionToken })
  const { data: benefitGrants, refetch } = useCustomerBenefitGrants(api, {
    checkoutId: checkout.id,
  })
  const expectedBenefits = checkout.product.benefits.length

  const customerEvents = useCustomerSSE(customerSessionToken)
  useEffect(() => {
    customerEvents.on('benefit.granted', refetch)
    return () => {
      customerEvents.off('benefit.granted', refetch)
    }
  }, [customerEvents, refetch])

  return (
    <>
      <div className="flex flex-col gap-4">
        <List>
          {benefitGrants?.items.map((benefitGrant) => (
            <ListItem key={benefitGrant.id}>
              <BenefitGrant api={api} benefitGrant={benefitGrant} />
            </ListItem>
          ))}
          {!benefitGrants ||
            (benefitGrants.items.length < expectedBenefits && (
              <ListItem className="flex flex-row items-center justify-center gap-2">
                <SpinnerNoMargin className="h-4 w-4" />
                <p className="dark:text-polar-500 text-gray-500">
                  Granting benefits...
                </p>
              </ListItem>
            ))}
        </List>
      </div>
    </>
  )
}

export default CheckoutBenefits
