import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { CustomerPortalGrantsComplex } from './CustomerPortalGrantsComplex'
import { CustomerPortalGrantsSimple } from './CustomerPortalGrantsSimple'

const SIMPLIFIED_VIEW_THRESHOLD = 10

export interface CustomerPortalGrantsProps {
  organization?: schemas['CustomerOrganization']
  api: Client
  subscriptionId?: string
  orderId?: string
}

export const CustomerPortalGrants = ({
  organization,
  api,
  subscriptionId,
  orderId,
}: CustomerPortalGrantsProps) => {
  // Build filter parameters based on what's provided
  const filterParams = {
    ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
    ...(orderId ? { order_id: orderId } : {}),
  }

  // Fetch initial data to determine which view to show
  const { data: initialResponse } = useCustomerBenefitGrants(api, {
    limit: SIMPLIFIED_VIEW_THRESHOLD,
    ...filterParams,
  })

  const totalBenefitGrantCount =
    initialResponse?.pagination?.total_count ??
    initialResponse?.items?.length ??
    0
  const initialBenefitGrants = initialResponse?.items ?? []

  const isSimplifiedView = totalBenefitGrantCount <= SIMPLIFIED_VIEW_THRESHOLD

  if (totalBenefitGrantCount === 0) {
    return null
  }

  return isSimplifiedView ? (
    <CustomerPortalGrantsSimple
      organization={organization}
      benefitGrants={initialBenefitGrants}
      api={api}
    />
  ) : (
    <CustomerPortalGrantsComplex
      api={api}
      subscriptionId={subscriptionId}
      orderId={orderId}
    />
  )
}
