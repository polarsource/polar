import { useProducts } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { OrdersWidget } from './OrdersWidget'
import { SubscriptionsWidget } from './SubscriptionsWidget'

// Organizations that only sell one-time products get orders instead of
// subscriptions. Brand-new organizations without products still see
// subscriptions, since that's what most of them start selling.
export const SalesWidget = ({ className }: { className?: string }) => {
  const { organization } = useContext(OrganizationContext)
  const { data: allProducts, isPending: isPendingAll } = useProducts(
    organization.id,
    { limit: 1 },
  )
  const { data: recurringProducts, isPending: isPendingRecurring } =
    useProducts(organization.id, { is_recurring: true, limit: 1 })

  // Hold an empty cell of the same height until both queries settle, so
  // one-time-only organizations don't flash the subscriptions widget.
  if (isPendingAll || isPendingRecurring) {
    return <div className={twMerge('h-88', className)} />
  }

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
