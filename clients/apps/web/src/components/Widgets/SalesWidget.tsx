import { useProducts } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import { OrdersWidget } from './OrdersWidget'
import { SubscriptionsWidget } from './SubscriptionsWidget'

// Organizations that only sell one-time products get orders instead of
// subscriptions. Brand-new organizations without products still see
// subscriptions, since that's what most of them start selling.
export const SalesWidget = ({ className }: { className?: string }) => {
  const { organization } = useContext(OrganizationContext)
  const { data: allProducts } = useProducts(organization.id, { limit: 1 })
  const { data: recurringProducts } = useProducts(organization.id, {
    is_recurring: true,
    limit: 1,
  })

  const isOneTimeOnly =
    allProducts !== undefined &&
    recurringProducts !== undefined &&
    allProducts.pagination.total_count > 0 &&
    recurringProducts.pagination.total_count === 0

  return isOneTimeOnly ? (
    <OrdersWidget className={className} />
  ) : (
    <SubscriptionsWidget className={className} />
  )
}
