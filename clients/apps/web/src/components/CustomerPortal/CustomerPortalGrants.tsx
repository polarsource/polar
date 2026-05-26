import { useCustomerBenefitGrants } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { CustomerPortalGrantsComplex } from './CustomerPortalGrantsComplex'
import { CustomerPortalGrantsGrouped } from './CustomerPortalGrantsGrouped'
import { CustomerPortalGrantsSimple } from './CustomerPortalGrantsSimple'

const SIMPLIFIED_VIEW_THRESHOLD = 10
const OVERVIEW_FETCH_LIMIT = 100

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
  const isFiltered = Boolean(subscriptionId || orderId)
  const filterParams = {
    ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
    ...(orderId ? { order_id: orderId } : {}),
  }

  // On the overview (no filter), pull all grants up-front so we can
  // dedup/group client-side. On filtered views, fetch only the threshold
  // to decide between Simple and Complex.
  const { data: initialResponse } = useCustomerBenefitGrants(api, {
    limit: isFiltered ? SIMPLIFIED_VIEW_THRESHOLD : OVERVIEW_FETCH_LIMIT,
    ...filterParams,
  })

  const totalBenefitGrantCount =
    initialResponse?.pagination?.total_count ??
    initialResponse?.items?.length ??
    0
  const initialBenefitGrants = initialResponse?.items ?? []

  if (totalBenefitGrantCount === 0) {
    return null
  }

  if (!isFiltered) {
    // If a customer ever exceeds the overview fetch limit, fall back to the
    // paginated complex view (no dedup/grouping in that edge case).
    if (totalBenefitGrantCount > OVERVIEW_FETCH_LIMIT) {
      return <CustomerPortalGrantsComplex api={api} />
    }
    return (
      <CustomerPortalGrantsGrouped
        api={api}
        benefitGrants={initialBenefitGrants}
      />
    )
  }

  const isSimplifiedView = totalBenefitGrantCount <= SIMPLIFIED_VIEW_THRESHOLD

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
